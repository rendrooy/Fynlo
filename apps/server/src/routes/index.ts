import { Router } from "express";

import {
  createAccountHandler,
  deleteAccountHandler,
  listAccountsHandler,
  updateAccountHandler,
} from "../controller/account-controller";
import {
  createAccountTypeHandler,
  deleteAccountTypeHandler,
  listAccountTypesHandler,
  renameAccountTypeHandler,
} from "../controller/account-type-controller";
import { loginHandler, meHandler } from "../controller/auth-controller";
import {
  budgetGroupHandlers,
  budgetHandlers,
  budgetPeriodHandlers,
} from "../controller/budget-controller";
import {
  createCategoryHandler,
  deleteCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
} from "../controller/category-controller";
import {
  createCategoryGroupHandler,
  deleteCategoryGroupHandler,
  listCategoryGroupsHandler,
  renameCategoryGroupHandler,
} from "../controller/category-group-controller";
import { liveHealth, readyHealth } from "../controller/health-controller";
import {
  createIngestTokenHandler,
  ingestAuthMiddleware,
  ingestHandler,
  listIngestEventsHandler,
  listIngestTokensHandler,
  retryIngestEventHandler,
  revokeIngestTokenHandler,
} from "../controller/ingest-controller";
import {
  importStatementHandler,
  previewStatementHandler,
  statementUpload,
} from "../controller/statement-controller";
import {
  createTransactionHandler,
  deleteTransactionHandler,
  listTransactionsHandler,
  updateTransactionHandler,
} from "../controller/transaction-controller";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  ingestRateLimit,
  loginRateLimit,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/health/live", liveHealth);
router.get("/health/ready", readyHealth);

router.post("/auth/login", loginRateLimit, loginHandler);
router.get("/auth/me", authMiddleware, meHandler);

router.get("/account-types", authMiddleware, listAccountTypesHandler);
router.post("/account-types", authMiddleware, createAccountTypeHandler);
router.patch("/account-types/:id", authMiddleware, renameAccountTypeHandler);
router.delete("/account-types/:id", authMiddleware, deleteAccountTypeHandler);

router.get("/accounts", authMiddleware, listAccountsHandler);
router.post("/accounts", authMiddleware, createAccountHandler);
router.patch("/accounts/:id", authMiddleware, updateAccountHandler);
router.delete("/accounts/:id", authMiddleware, deleteAccountHandler);

router.get("/category-groups", authMiddleware, listCategoryGroupsHandler);
router.post("/category-groups", authMiddleware, createCategoryGroupHandler);
router.patch(
  "/category-groups/:id",
  authMiddleware,
  renameCategoryGroupHandler,
);
router.delete(
  "/category-groups/:id",
  authMiddleware,
  deleteCategoryGroupHandler,
);

router.get("/categories", authMiddleware, listCategoriesHandler);
router.post("/categories", authMiddleware, createCategoryHandler);
router.patch("/categories/:id", authMiddleware, updateCategoryHandler);
router.delete("/categories/:id", authMiddleware, deleteCategoryHandler);

router.post("/ingest", ingestRateLimit, ingestAuthMiddleware, ingestHandler);
router.get("/ingest/events", authMiddleware, listIngestEventsHandler);
router.post(
  "/ingest/events/:id/retry",
  authMiddleware,
  retryIngestEventHandler,
);
router.get("/ingest-tokens", authMiddleware, listIngestTokensHandler);
router.post("/ingest-tokens", authMiddleware, createIngestTokenHandler);
router.delete("/ingest-tokens/:id", authMiddleware, revokeIngestTokenHandler);

router.get("/budgets", authMiddleware, budgetHandlers.list);
router.post("/budgets", authMiddleware, budgetHandlers.create);
router.patch("/budgets/:id", authMiddleware, budgetHandlers.update);
router.delete("/budgets/:id", authMiddleware, budgetHandlers.remove);

router.get("/budget-periods", authMiddleware, budgetPeriodHandlers.list);
router.post("/budget-periods", authMiddleware, budgetPeriodHandlers.create);
router.patch(
  "/budget-periods/:id",
  authMiddleware,
  budgetPeriodHandlers.update,
);
router.delete(
  "/budget-periods/:id",
  authMiddleware,
  budgetPeriodHandlers.remove,
);

router.get("/budget-groups", authMiddleware, budgetGroupHandlers.list);
router.post("/budget-groups", authMiddleware, budgetGroupHandlers.create);
router.patch("/budget-groups/:id", authMiddleware, budgetGroupHandlers.update);
router.delete("/budget-groups/:id", authMiddleware, budgetGroupHandlers.remove);

router.get("/transactions", authMiddleware, listTransactionsHandler);
router.post("/transactions", authMiddleware, createTransactionHandler);
router.patch("/transactions/:id", authMiddleware, updateTransactionHandler);
router.delete("/transactions/:id", authMiddleware, deleteTransactionHandler);

router.post(
  "/statements/preview",
  authMiddleware,
  statementUpload,
  previewStatementHandler,
);
router.post("/statements/import", authMiddleware, importStatementHandler);

export default router;
