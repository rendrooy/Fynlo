import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
// scrypt needs 128 * N * r bytes, which is above Node's default limit at this cost.
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

/** Stored as scrypt$N$r$p$salt$key so the cost can be raised later. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(
    password,
    salt,
    KEY_LENGTH,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
  );
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, cost, blockSize, parallelization, salt, key] =
    stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(
    password,
    Buffer.from(salt, "base64"),
    expected.length,
    Number(cost),
    Number(blockSize),
    Number(parallelization),
  );
  return timingSafeEqual(actual, expected);
}

function derive(
  password: string,
  salt: Buffer,
  length: number,
  cost: number,
  blockSize: number,
  parallelization: number,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      { maxmem: MAX_MEMORY, N: cost, p: parallelization, r: blockSize },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}
