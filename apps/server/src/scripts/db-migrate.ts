import type { PoolClient } from "pg";

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { dbConfig } from "../config";
import { pool } from "../connection/db";

type Command = "apply" | "status" | "validate";

const MIGRATIONS_DIR = resolve(__dirname, "../../../../database/migrations");
const FILENAME_PATTERN = /^\d{6}_[a-z0-9_-]+\.sql$/;
// Serializes concurrent runs. The value only has to be unique within this database.
const ADVISORY_LOCK_KEY = 7_203_114;

async function appliedChecksums(client: PoolClient) {
  const { rows } = await client.query<{ checksum: string; filename: string }>(
    "SELECT filename, checksum FROM m_schema_migration ORDER BY filename",
  );
  return new Map(rows.map((row) => [row.filename, row.checksum]));
}

function assertUnchanged(
  migrations: ReturnType<typeof loadMigrations>,
  applied: Map<string, string>,
) {
  const known = new Set(migrations.map((migration) => migration.filename));
  for (const filename of applied.keys()) {
    if (!known.has(filename)) {
      throw new Error(`Applied migration is missing from disk: ${filename}`);
    }
  }
  for (const { checksum, filename } of migrations) {
    const recorded = applied.get(filename);
    if (recorded && recorded !== checksum) {
      throw new Error(`Applied migration was edited: ${filename}`);
    }
  }
}

function loadMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((filename) => filename.endsWith(".sql"))
    .sort()
    .map((filename) => {
      if (!FILENAME_PATTERN.test(filename)) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }
      // Git may convert line endings on checkout, which must not change the checksum.
      const sql = readFileSync(
        resolve(MIGRATIONS_DIR, filename),
        "utf8",
      ).replace(/\r\n/g, "\n");
      return {
        checksum: createHash("sha256").update(sql).digest("hex"),
        filename,
        sql,
      };
    });
}

async function run(command: Command) {
  const migrations = loadMigrations();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${dbConfig.schema}"`);
    await client.query(`SET search_path TO "${dbConfig.schema}"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS m_schema_migration (
        filename varchar(255) PRIMARY KEY,
        checksum char(64) NOT NULL,
        applied_time timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = await appliedChecksums(client);
    assertUnchanged(migrations, applied);
    const pending = migrations.filter((m) => !applied.has(m.filename));

    if (command === "status") {
      for (const { filename } of migrations) {
        console.log(
          `${applied.has(filename) ? "applied" : "pending"}  ${filename}`,
        );
      }
      return;
    }
    if (command === "validate") {
      console.log(`Valid: ${applied.size} applied, ${pending.length} pending`);
      return;
    }

    for (const { checksum, filename, sql } of pending) {
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO m_schema_migration (filename, checksum) VALUES ($1, $2)",
          [filename, checksum],
        );
        await client.query("COMMIT");
        console.log(`Applied ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log(pending.length ? "Done" : "Nothing to apply");
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY])
      .catch(() => {});
    client.release();
    await pool.end();
  }
}

const command = process.argv[2];
if (command !== "apply" && command !== "status" && command !== "validate") {
  console.error("Usage: db-migrate <apply|status|validate>");
  process.exit(1);
}

run(command).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
