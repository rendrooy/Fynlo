import type { Request, Response } from "express";

import { pool } from "../connection/db";

export const liveHealth = (_request: Request, response: Response) => {
  response.status(200).json({
    data: { uptime_seconds: Math.round(process.uptime()) },
    message: "OK",
    status: 200,
  });
};

export const readyHealth = async (_request: Request, response: Response) => {
  let database = false;
  try {
    await pool.query("SELECT 1");
    database = true;
  } catch {
    // Reported through the checks below.
  }
  const status = database ? 200 : 503;
  response.status(status).json({
    data: { checks: { database } },
    message: database ? "READY" : "NOT_READY",
    status,
  });
};
