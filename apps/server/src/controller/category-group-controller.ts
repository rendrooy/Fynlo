import type { Request, Response } from "express";

import {
  createCategoryGroup,
  deleteCategoryGroup,
  listCategoryGroups,
  renameCategoryGroup,
} from "../services/category-group-service";

const bodyOf = (request: Request<{ id?: string }>) =>
  (request.body ?? {}) as Record<string, unknown>;

export const listCategoryGroupsHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(200).json({
    data: await listCategoryGroups(request.userId as string),
    message: "OK",
    status: 200,
  });
};

export const createCategoryGroupHandler = async (
  request: Request,
  response: Response,
) => {
  response.status(201).json({
    data: await createCategoryGroup(request.userId as string, bodyOf(request)),
    message: "Created",
    status: 201,
  });
};

export const renameCategoryGroupHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  response.status(200).json({
    data: await renameCategoryGroup(
      request.userId as string,
      request.params.id,
      bodyOf(request),
    ),
    message: "OK",
    status: 200,
  });
};

export const deleteCategoryGroupHandler = async (
  request: Request<{ id: string }>,
  response: Response,
) => {
  await deleteCategoryGroup(request.userId as string, request.params.id);
  response.status(200).json({ message: "Deleted", status: 200 });
};
