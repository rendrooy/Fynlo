import type { Request, Response } from "express";

import {
  createBudgetGroup,
  deleteBudgetGroup,
  listBudgetGroups,
  renameBudgetGroup,
} from "../services/budget-group-service";
import {
  createBudgetPeriod,
  deleteBudgetPeriod,
  listBudgetPeriods,
  updateBudgetPeriod,
} from "../services/budget-period-service";
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
} from "../services/budget-service";

type Input = Record<string, unknown>;

const bodyOf = (request: Request<{ id?: string }>) =>
  (request.body ?? {}) as Input;

const handlers = (service: {
  create: (userId: string, input: Input) => Promise<unknown>;
  list: (userId: string) => Promise<unknown>;
  remove: (userId: string, id: string) => Promise<void>;
  update: (userId: string, id: string, input: Input) => Promise<unknown>;
}) => ({
  create: async (request: Request, response: Response) => {
    response.status(201).json({
      data: await service.create(request.userId as string, bodyOf(request)),
      message: "Created",
      status: 201,
    });
  },
  list: async (request: Request, response: Response) => {
    response.status(200).json({
      data: await service.list(request.userId as string),
      message: "OK",
      status: 200,
    });
  },
  remove: async (request: Request<{ id: string }>, response: Response) => {
    await service.remove(request.userId as string, request.params.id);
    response.status(200).json({ message: "Deleted", status: 200 });
  },
  update: async (request: Request<{ id: string }>, response: Response) => {
    response.status(200).json({
      data: await service.update(
        request.userId as string,
        request.params.id,
        bodyOf(request),
      ),
      message: "OK",
      status: 200,
    });
  },
});

export const budgetHandlers = handlers({
  create: createBudget,
  list: listBudgets,
  remove: deleteBudget,
  update: updateBudget,
});

export const budgetGroupHandlers = handlers({
  create: createBudgetGroup,
  list: listBudgetGroups,
  remove: deleteBudgetGroup,
  update: renameBudgetGroup,
});

export const budgetPeriodHandlers = handlers({
  create: createBudgetPeriod,
  list: listBudgetPeriods,
  remove: deleteBudgetPeriod,
  update: updateBudgetPeriod,
});
