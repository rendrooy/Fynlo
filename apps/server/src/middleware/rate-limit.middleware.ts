import { rateLimit } from "express-rate-limit";

/** A script sends a steady trickle. This only stops a runaway loop or a guessed token. */
export const ingestRateLimit = rateLimit({
  legacyHeaders: false,
  limit: 300,
  message: { message: "Too many requests. Try again later.", status: 429 },
  standardHeaders: "draft-8",
  windowMs: 15 * 60 * 1000,
});

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
