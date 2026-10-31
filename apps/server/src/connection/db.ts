import { Pool } from "pg";

import { dbConfig } from "../config";
import { logger } from "../config/logger";

export const pool = new Pool({
  connectionString: dbConfig.connectionString,
  // Supabase certificates are not in Node's default trust store.
  ssl: dbConfig.caCertificate
    ? { ca: dbConfig.caCertificate, rejectUnauthorized: true }
    : dbConfig.connectionString.includes("supabase")
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on("connect", (client) => {
  client
    .query(`SET search_path TO "${dbConfig.schema}"`)
    .catch((error: unknown) =>
      logger.error({ err: error }, "Failed to set search_path"),
    );
});

pool.on("error", (error) => {
  logger.error({ err: error }, "Idle database client error");
});
