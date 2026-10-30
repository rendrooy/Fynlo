import type { NextFunction, Request, Response } from "express";

import multer from "multer";

import {
  importStatement,
  previewStatement,
} from "../services/statement-service";
import { HttpError } from "../utils/http-error";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Memory storage on purpose: statements must never reach the disk.
const upload = multer({
  limits: { fields: 5, files: 1, fileSize: MAX_FILE_SIZE },
  storage: multer.memoryStorage(),
}).single("file");

export const statementUpload = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  upload(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new HttpError(
          400,
          error.code === "LIMIT_FILE_SIZE"
            ? "The PDF must be 10 MB or smaller"
            : "This upload is not valid",
        ),
      );
      return;
    }
    next(error);
  });
};

export const previewStatementHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await previewStatement(
      request.userId as string,
      (request.body ?? {}) as Record<string, unknown>,
      request.file?.buffer,
    ),
    message: "OK",
    status: 200,
  });
};

export const importStatementHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(201).json({
    data: await importStatement(
      request.userId as string,
      (request.body ?? {}) as Record<string, unknown>,
    ),
    message: "Created",
    status: 201,
  });
};
