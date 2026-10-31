import type { NextFunction, Request, Response } from "express";

import {
  createIngestToken,
  findUserByIngestToken,
  ingestMessage,
  listIngestEvents,
  listIngestTokens,
  retryIngestEvent,
  revokeIngestToken,
} from "../services/ingest-service";
import { HttpError } from "../utils/http-error";

const bodyOf = (request: Request) =>
  (request.body ?? {}) as Record<string, unknown>;

/** Device tokens work only here, so a leaked one can't read any financial data. */
export const ingestAuthMiddleware = async (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  const userId =
    scheme === "Bearer" && token ? await findUserByIngestToken(token) : null;
  if (!userId) throw new HttpError(401, "Unauthorized");
  request.userId = userId;
  next();
};

export const ingestHandler = async (request: Request, response: Response) => {
  response.status(200).json({
    data: await ingestMessage(request.userId as string, bodyOf(request)),
    message: "OK",
    status: 200,
  });
};

export const listIngestEventsHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await listIngestEvents(request.userId as string),
    message: "OK",
    status: 200,
  });
};

export const retryIngestEventHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  response.status(200).json({
    data: await retryIngestEvent(request.userId as string, request.params.id),
    message: "OK",
    status: 200,
  });
};

export const listIngestTokensHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await listIngestTokens(request.userId as string),
    message: "OK",
    status: 200,
  });
};

export const createIngestTokenHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(201).json({
    data: await createIngestToken(request.userId as string, bodyOf(request)),
    message: "Created",
    status: 201,
  });
};

export const revokeIngestTokenHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  await revokeIngestToken(request.userId as string, request.params.id);
  response.status(200).json({ message: "Revoked", status: 200 });
};
