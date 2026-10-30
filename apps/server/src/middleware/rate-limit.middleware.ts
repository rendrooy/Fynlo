import { rateLimit } from "express-rate-limit";

/** Counts only failed attempts, so normal logins never lock the owner out. */
export const loginRateLimit = rateLimit({
  legacyHeaders: false,
  limit: 10,
  message: {
    message: "Too many login attempts. Try again later.",
    status: 429,
  },
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  windowMs: 15 * 60 * 1000,
});
