import { createInterface } from "node:readline";

import { pool } from "../connection/db";
import { hashPassword } from "../utils/password";

const MIN_PASSWORD_LENGTH = 12;

/** Reads a line from stdin, hiding what is typed when run in a terminal. */
function readPassword(prompt: string) {
  return new Promise<string>((resolve) => {
    const input = process.stdin;
    process.stdout.write(prompt);
    if (!input.isTTY) {
      const reader = createInterface({ input });
      reader.once("line", (line) => {
        reader.close();
        resolve(line);
      });
      return;
    }
    let value = "";
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") process.exit(130);
        if (char === "\r" || char === "\n") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on("data", onData);
  });
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const name = nameParts.join(" ").trim();
  if (!email || !email.includes("@") || !name) {
    throw new Error('Usage: pnpm user:create <email> "<full name>"');
  }

  const password = await readPassword("Password: ");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must have at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  const { rowCount } = await pool.query(
    `INSERT INTO m_user (email, password_hash, name, initials)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    [email, await hashPassword(password), name, initialsOf(name)],
  );
  if (!rowCount) throw new Error(`User already exists: ${email}`);
  console.log(`Created user ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
