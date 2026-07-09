export type AppEnv = "development" | "test" | "production";

export type EnvConfig = {
  nodeEnv: AppEnv;
  apiPort: number;
  corsOrigins: string[];
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  passwordHashRounds: number;
  adminSetupToken: string;
  authRateLimitTtlMs: number;
  authRateLimitMax: number;
};

const DEFAULT_INSECURE_SECRETS = new Set([
  "change-me",
  "change-me-in-local-env",
  "secret",
  "jwt-secret",
]);

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }

  return value;
}

function readAppEnv(): AppEnv {
  const value = process.env.NODE_ENV ?? "development";
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error("NODE_ENV must be development, test, or production");
}

function readCorsOrigins(): string[] {
  return readRequiredEnv("CORS_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function assertStrongSecret(name: string, value: string, nodeEnv: AppEnv): void {
  if (nodeEnv !== "production") {
    return;
  }

  if (value.length < 32 || DEFAULT_INSECURE_SECRETS.has(value)) {
    throw new Error(`${name} must be strong and non-default in production`);
  }
}

export function loadEnvConfig(): EnvConfig {
  const nodeEnv = readAppEnv();
  const jwtSecret = readRequiredEnv("JWT_SECRET");
  const adminSetupToken = readRequiredEnv("ADMIN_SETUP_TOKEN");

  assertStrongSecret("JWT_SECRET", jwtSecret, nodeEnv);
  assertStrongSecret("ADMIN_SETUP_TOKEN", adminSetupToken, nodeEnv);

  return {
    nodeEnv,
    apiPort: readNumberEnv("API_PORT", 3333),
    corsOrigins: readCorsOrigins(),
    databaseUrl: readRequiredEnv("DATABASE_URL"),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || "2h",
    passwordHashRounds: readNumberEnv("PASSWORD_HASH_ROUNDS", 12),
    adminSetupToken,
    authRateLimitTtlMs: readNumberEnv("AUTH_RATE_LIMIT_TTL_MS", 60_000),
    authRateLimitMax: readNumberEnv("AUTH_RATE_LIMIT_MAX", 5),
  };
}
