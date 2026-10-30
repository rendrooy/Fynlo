import type { Request, Response } from "express";

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../services/category-service";

const bodyOf = (request: Request<{ id?: string }>) =>
  (request.body ?? {}) as Record<string, unknown>;

export const listCategoriesHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await listCategories(request.userId as string),
    message: "OK",
    status: 200,
  });
};

export const createCategoryHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(201).json({
    data: await createCategory(request.userId as string, bodyOf(request)),
    message: "Created",
    status: 201,
  });
};

export const updateCategoryHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  response.status(200).json({
    data: await updateCategory(
      request.userId as string,
      request.params.id,
      bodyOf(request),
    ),
    message: "OK",
    status: 200,
  });
};

export const deleteCategoryHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  await deleteCategory(request.userId as string, request.params.id);
  response.status(200).json({ message: "Deleted", status: 200 });
};
