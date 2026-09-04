export type AppEnv = "development" | "test" | "production";

export type EnvConfig = {
  nodeEnv: AppEnv;
  apiPort: number;
  corsOrigins: string[];
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  passwordHashRounds: number;
  adminBootstrapEnabled: boolean;
  adminSetupToken?: string;
  authRateLimitTtlMs: number;
  authRateLimitMax: number;
  rateLimitMaxBuckets: number;
  trustedProxyHops: number;
  documentStorageDir: string;
  documentMaxSizeBytes: number;
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

function readNonNegativeNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
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
  const origins = readRequiredEnv("CORS_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGINS cannot include * when credentials are enabled");
  }
  for (const origin of origins) {
    try {
      new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
  }
  return origins;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

function assertProductionCorsOrigins(origins: string[]): void {
  const allowLocalhost = readBooleanEnv("ALLOW_LOCALHOST_CORS_IN_PRODUCTION", false);
  if (allowLocalhost) {
    return;
  }

  const localOrigin = origins.find((origin) => {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  });
  if (localOrigin) {
    throw new Error(
      `CORS_ORIGINS cannot include local development origin in production: ${localOrigin}`,
    );
  }
}

function assertStrongSecret(name: string, value: string, nodeEnv: AppEnv): void {
  if (nodeEnv !== "production") {
    return;
  }

  if (value.length < 32 || DEFAULT_INSECURE_SECRETS.has(value)) {
    throw new Error(`${name} must be strong and non-default in production`);
  }
}

function assertSetupToken(value: string, nodeEnv: AppEnv): void {
  if (value.length < 32) {
    throw new Error(
      "ADMIN_SETUP_TOKEN must have at least 32 characters when bootstrap is enabled",
    );
  }
  assertStrongSecret("ADMIN_SETUP_TOKEN", value, nodeEnv);
}

export function loadEnvConfig(): EnvConfig {
  const nodeEnv = readAppEnv();
  const corsOrigins = readCorsOrigins();
  const jwtSecret = readRequiredEnv("JWT_SECRET");
  const adminBootstrapEnabled = readBooleanEnv("ADMIN_BOOTSTRAP_ENABLED", false);
  const adminSetupToken = process.env.ADMIN_SETUP_TOKEN?.trim() || undefined;

  assertStrongSecret("JWT_SECRET", jwtSecret, nodeEnv);
  if (nodeEnv === "production") {
    assertProductionCorsOrigins(corsOrigins);
  }
  if (adminBootstrapEnabled) {
    if (!adminSetupToken) {
      throw new Error(
        "ADMIN_SETUP_TOKEN is required when ADMIN_BOOTSTRAP_ENABLED is true",
      );
    }
    assertSetupToken(adminSetupToken, nodeEnv);
  }

  return {
    nodeEnv,
    apiPort: readNumberEnv("API_PORT", 3333),
    corsOrigins,
    databaseUrl: readRequiredEnv("DATABASE_URL"),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || "2h",
    passwordHashRounds: readNumberEnv("PASSWORD_HASH_ROUNDS", 12),
    adminBootstrapEnabled,
    adminSetupToken,
    authRateLimitTtlMs: readNumberEnv("AUTH_RATE_LIMIT_TTL_MS", 60_000),
    authRateLimitMax: readNumberEnv("AUTH_RATE_LIMIT_MAX", 5),
    rateLimitMaxBuckets: readNumberEnv("RATE_LIMIT_MAX_BUCKETS", 10_000),
    trustedProxyHops: readNonNegativeNumberEnv("TRUSTED_PROXY_HOPS", 0),
    documentStorageDir:
      process.env.DOCUMENT_STORAGE_DIR?.trim() ||
      "/opt/codeacode/storage/atretu/private-documents",
    documentMaxSizeBytes: readNumberEnv(
      "DOCUMENT_MAX_SIZE_BYTES",
      8 * 1024 * 1024,
    ),
  };
}
