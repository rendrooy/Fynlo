import type { Request, Response } from "express";

import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  markNotDuplicate,
  updateTransaction,
} from "../services/transaction-service";

const bodyOf = (request: Request<{ id?: string }>) =>
  (request.body ?? {}) as Record<string, unknown>;

export const listTransactionsHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await listTransactions(request.userId as string),
    message: "OK",
    status: 200,
  });
};

export const createTransactionHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(201).json({
    data: await createTransaction(request.userId as string, bodyOf(request)),
    message: "Created",
    status: 201,
  });
};

export const updateTransactionHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  response.status(200).json({
    data: await updateTransaction(
      request.userId as string,
      request.params.id,
      bodyOf(request),
    ),
    message: "OK",
    status: 200,
  });
};

export const markNotDuplicateHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await markNotDuplicate(request.userId as string, bodyOf(request)),
    message: "OK",
    status: 200,
  });
};

export const deleteTransactionHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  await deleteTransaction(request.userId as string, request.params.id);
  response.status(200).json({ message: "Deleted", status: 200 });
};
