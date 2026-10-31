import { createInterface } from "node:readline";

import { pool } from "../connection/db";
import { DEFAULT_ACCOUNT_TYPES } from "../services/account-type-service";
import { DEFAULT_BUDGET_GROUPS } from "../services/budget-group-service";
import { DEFAULT_BUDGET_PERIODS } from "../services/budget-period-service";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_GROUPS,
} from "../services/category-group-service";
import { hashPassword } from "../utils/password";

const MIN_PASSWORD_LENGTH = 12;

/** Reads a line from stdin, hiding what is typed when run in a terminal. */
function readPassword(prompt: string) {
  return new Promise<string>((resolve) => {
    const input = process.stdin;
    process.stdout.write(prompt);
    if (!input.isTTY) {
      const reader = createInterface({ input });
      reader.once("line", (line) => {
        reader.close();
        resolve(line);
      });
      return;
    }
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") process.exit(130);
        if (char === "\r" || char === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", onData);
  });
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const name = nameParts.join(" ").trim();
  if (!email || !email.includes("@") || !name) {
    throw new Error('Usage: pnpm user:create <email> "<full name>"');
  }

  const password = await readPassword("Password: ");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must have at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  // A single statement, so a user can never exist without their starter data.
  const { rowCount } = await pool.query(
    `WITH new_user AS (
       INSERT INTO m_user (email, password_hash, name, initials)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id
     ),
     new_types AS (
       INSERT INTO m_account_type (user_id, name)
       SELECT new_user.id, type_name
       FROM new_user CROSS JOIN unnest($5::text[]) AS type_name
     ),
     new_budget_groups AS (
       INSERT INTO m_budget_group (user_id, name)
       SELECT new_user.id, group_name
       FROM new_user CROSS JOIN unnest($8::text[]) AS group_name
     ),
     new_budget_periods AS (
       INSERT INTO m_budget_period (user_id, name, unit, start_date)
       SELECT new_user.id, p.name, p.unit, p."startDate"::date
       FROM new_user
       CROSS JOIN jsonb_to_recordset($9::jsonb)
         AS p (name text, unit text, "startDate" text)
     ),
     new_groups AS (
       INSERT INTO m_category_group (user_id, name, type)
       SELECT new_user.id, g.name, g.type
       FROM new_user
       CROSS JOIN jsonb_to_recordset($6::jsonb) AS g (name text, type text)
       RETURNING id, user_id, name, type
     )
     INSERT INTO m_category (user_id, group_id, name, type, icon, color)
     SELECT g.user_id, g.id, c.name, g.type, c.icon, c.color
     FROM new_groups g
     JOIN jsonb_to_recordset($7::jsonb)
       AS c ("group" text, name text, icon text, color text)
       ON c."group" = g.name`,
    [
      email,
      await hashPassword(password),
      name,
      initialsOf(name),
      DEFAULT_ACCOUNT_TYPES,
      JSON.stringify(DEFAULT_CATEGORY_GROUPS),
      JSON.stringify(DEFAULT_CATEGORIES),
      DEFAULT_BUDGET_GROUPS,
      JSON.stringify(DEFAULT_BUDGET_PERIODS),
    ],
  );
  if (!rowCount) throw new Error(`User already exists: ${email}`);
  console.log(`Created user ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
