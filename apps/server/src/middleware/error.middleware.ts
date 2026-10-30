import type { NextFunction, Request, Response } from "express";

import { logger } from "../config/logger";

interface AppError extends Error {
  status?: number;
}

export const errorMiddleware = (
  error: AppError,
  request: Request,
  response: Response,
  // Express identifies error middleware by its four parameters.
  _next: NextFunction,
) => {
  const status = error.status || 500;
  logger.error(
    { err: error, method: request.method, url: request.originalUrl },
    "Request failed",
  );
  // Internal error messages can expose database details, so 5xx stays generic.
  response.status(status).json({
    message: status >= 500 ? "Internal Server Error" : error.message,
    status,
  });
};
