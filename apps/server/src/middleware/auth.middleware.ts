import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../utils/http-error";
import { verifyToken } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authMiddleware = (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  const userId = scheme === "Bearer" && token ? verifyToken(token) : null;
  if (!userId) throw new HttpError(401, "Unauthorized");
  request.userId = userId;
  next();
};
