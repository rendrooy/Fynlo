import type { Request, Response } from "express";

import { getProfile, login } from "../services/auth-service";
import { HttpError } from "../utils/http-error";

export const loginHandler = async (request: Request, response: Response) => {
  const { email, password } = (request.body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    throw new HttpError(400, "Email and password are required");
  }
  response.status(200).json({
    data: await login(email, password),
    message: "OK",
    status: 200,
  });
};

export const meHandler = async (request: Request, response: Response) => {
  response.status(200).json({
    data: await getProfile(request.userId as string),
    message: "OK",
    status: 200,
  });
};
