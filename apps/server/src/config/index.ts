import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Variables already set in the environment take priority over the file.
const envPath = resolve(__dirname, "../../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const isProduction = process.env.NODE_ENV === "production";

const schema = process.env.DB_SCHEMA || "fynlo";
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
  throw new Error(
    "DB_SCHEMA must contain only lowercase letters, digits, and underscores",
  );
}

export const dbConfig = {
  // Without a CA file the connection is encrypted, but the server's identity isn't verified.
  caCertificate: process.env.DATABASE_CA_PATH
    ? readFileSync(process.env.DATABASE_CA_PATH, "utf8")
    : null,
  connectionString: requireEnv("DATABASE_URL"),
  schema,
};

export const serverConfig = {
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim()),
  host: process.env.HOST,
  port: Number(process.env.PORT || 4000),
  // How many proxies stand in front of the API. Rate limits need the real client address.
  trustProxy: Number(process.env.TRUST_PROXY || 0),
};

export const jwtConfig = {
  expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  secret: requireEnv("JWT_SECRET"),
};

if (isProduction && jwtConfig.secret.startsWith("replace-with")) {
  throw new Error("JWT_SECRET still has the example value");
}
