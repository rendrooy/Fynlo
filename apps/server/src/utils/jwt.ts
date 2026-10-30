import jwt, { type SignOptions } from "jsonwebtoken";

import { jwtConfig } from "../config";

const ALGORITHM = "HS256";

export function signToken(userId: string) {
  return jwt.sign({}, jwtConfig.secret, {
    algorithm: ALGORITHM,
    expiresIn: jwtConfig.expiresIn as SignOptions["expiresIn"],
    subject: userId,
  });
}

/** Returns the user id, or null when the token is invalid or expired. */
export function verifyToken(token: string) {
  try {
    const payload = jwt.verify(token, jwtConfig.secret, {
      algorithms: [ALGORITHM],
    });
    return typeof payload === "object" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
