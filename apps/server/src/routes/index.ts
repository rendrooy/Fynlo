import { Router } from "express";

import { liveHealth, readyHealth } from "../controller/health-controller";

const router = Router();

router.get("/health/live", liveHealth);
router.get("/health/ready", readyHealth);

export default router;
