import { Router } from "express";

import { loginHandler, meHandler } from "../controller/auth-controller";
import { liveHealth, readyHealth } from "../controller/health-controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { loginRateLimit } from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/health/live", liveHealth);
router.get("/health/ready", readyHealth);

router.post("/auth/login", loginRateLimit, loginHandler);
router.get("/auth/me", authMiddleware, meHandler);

export default router;
