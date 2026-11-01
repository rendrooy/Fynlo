import type { Request, Response } from "express";

import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from "../services/account-service";
import { adjustAccountBalance } from "../services/balance-adjustment";

const bodyOf = (request: Request) =>
  (request.body ?? {}) as Record<string, unknown>;

export const adjustAccountBalanceHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  response.status(201).json({
    data: await adjustAccountBalance(
      request.userId as string,
      request.params.id,
      (request.body ?? {}) as Record<string, unknown>,
    ),
    message: "Created",
    status: 201,
  });
};

export const listAccountsHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await listAccounts(request.userId as string),
    message: "OK",
    status: 200,
  });
};

export const createAccountHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(201).json({
    data: await createAccount(request.userId as string, bodyOf(request)),
    message: "Created",
    status: 201,
  });
};

export const updateAccountHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  response.status(200).json({
    data: await updateAccount(
      request.userId as string,
      request.params.id,
      (request.body ?? {}) as Record<string, unknown>,
    ),
    message: "OK",
    status: 200,
  });
};

export const deleteAccountHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  await deleteAccount(request.userId as string, request.params.id);
  response.status(200).json({ message: "Deleted", status: 200 });
};
