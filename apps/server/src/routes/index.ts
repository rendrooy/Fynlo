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
import { liveHealth, readyHealth } from "../controller/health-controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { loginRateLimit } from "../middleware/rate-limit.middleware";

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

export default router;
