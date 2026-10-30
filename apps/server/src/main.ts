import * as http from "node:http";

import app from "./app";
import { serverConfig } from "./config";
import { logger } from "./config/logger";
import { pool } from "./connection/db";

const server = http.createServer(app);

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async (error) => {
    await pool.end().catch((poolError: unknown) => {
      logger.error({ err: poolError }, "Database pool close failed");
    });
    process.exit(error ? 1 : 0);
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

server.listen(serverConfig.port, () => {
  logger.info({ port: serverConfig.port }, "API server started");
});
