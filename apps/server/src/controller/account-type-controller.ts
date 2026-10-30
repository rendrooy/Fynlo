import type { Request, Response } from "express";

import {
  createAccountType,
  deleteAccountType,
  listAccountTypes,
  renameAccountType,
} from "../services/account-type-service";

const bodyOf = (request: Request<{ id?: string }>) =>
  (request.body ?? {}) as Record<string, unknown>;

export const listAccountTypesHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await listAccountTypes(request.userId as string),
    message: "OK",
    status: 200,
  });
};

export const createAccountTypeHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(201).json({
    data: await createAccountType(request.userId as string, bodyOf(request)),
    message: "Created",
    status: 201,
  });
};

export const renameAccountTypeHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  response.status(200).json({
    data: await renameAccountType(
      request.userId as string,
      request.params.id,
      bodyOf(request),
    ),
    message: "OK",
    status: 200,
  });
};

export const deleteAccountTypeHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  await deleteAccountType(request.userId as string, request.params.id);
  response.status(200).json({ message: "Deleted", status: 200 });
};
