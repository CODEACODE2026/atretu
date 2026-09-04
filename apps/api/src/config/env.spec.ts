import assert from "node:assert/strict";
import { loadEnvConfig } from "./env.js";

const originalEnv = { ...process.env };

function resetEnv(overrides: NodeJS.ProcessEnv): void {
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
    API_PORT: "3333",
    CORS_ORIGINS: "http://localhost:3000",
    DATABASE_URL: "postgresql://atretu:atretu@localhost:5432/atretu_test",
    JWT_SECRET: "test-secret-with-more-than-thirty-two-characters",
    ADMIN_SETUP_TOKEN: "test-admin-token-with-more-than-thirty-two-characters",
    DOCUMENT_STORAGE_DIR: "/tmp/atretu-test-documents",
    DOCUMENT_MAX_SIZE_BYTES: "8388608",
    ...overrides,
  };
}

resetEnv({});
assert.equal(loadEnvConfig().apiPort, 3333);
assert.equal(loadEnvConfig().documentMaxSizeBytes, 8388608);
assert.equal(loadEnvConfig().trustedProxyHops, 0);
assert.equal(loadEnvConfig().rateLimitMaxBuckets, 10000);
assert.equal(loadEnvConfig().adminBootstrapEnabled, false);

resetEnv({ ADMIN_BOOTSTRAP_ENABLED: "true" });
assert.equal(loadEnvConfig().adminBootstrapEnabled, true);

resetEnv({ ADMIN_BOOTSTRAP_ENABLED: "true", ADMIN_SETUP_TOKEN: "" });
assert.throws(() => loadEnvConfig(), /ADMIN_SETUP_TOKEN/);

resetEnv({ ADMIN_BOOTSTRAP_ENABLED: "true", ADMIN_SETUP_TOKEN: "short-token" });
assert.throws(() => loadEnvConfig(), /at least 32 characters/);

resetEnv({ NODE_ENV: "production", JWT_SECRET: "change-me-in-local-env" });
assert.throws(() => loadEnvConfig(), /JWT_SECRET/);

resetEnv({
  NODE_ENV: "production",
  CORS_ORIGINS: "https://atretu.example.com",
  ADMIN_BOOTSTRAP_ENABLED: "true",
  ADMIN_SETUP_TOKEN: "secret",
});
assert.throws(() => loadEnvConfig(), /ADMIN_SETUP_TOKEN/);

resetEnv({
  NODE_ENV: "production",
  CORS_ORIGINS: "https://atretu.example.com",
  ADMIN_SETUP_TOKEN: "",
});
assert.equal(loadEnvConfig().adminSetupToken, undefined);

resetEnv({
  NODE_ENV: "production",
  CORS_ORIGINS: "http://localhost:3000,https://atretu.example.com",
});
assert.throws(() => loadEnvConfig(), /local development origin/);

resetEnv({
  NODE_ENV: "production",
  CORS_ORIGINS: "http://localhost:3000,https://atretu.example.com",
  ALLOW_LOCALHOST_CORS_IN_PRODUCTION: "true",
});
assert.deepEqual(loadEnvConfig().corsOrigins, [
  "http://localhost:3000",
  "https://atretu.example.com",
]);

resetEnv({ DOCUMENT_MAX_SIZE_BYTES: "0" });
assert.throws(() => loadEnvConfig(), /DOCUMENT_MAX_SIZE_BYTES/);

resetEnv({ CORS_ORIGINS: "*" });
assert.throws(() => loadEnvConfig(), /CORS_ORIGINS/);

resetEnv({ TRUSTED_PROXY_HOPS: "-1" });
assert.throws(() => loadEnvConfig(), /TRUSTED_PROXY_HOPS/);

process.env = originalEnv;
