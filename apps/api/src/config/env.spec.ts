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

resetEnv({ NODE_ENV: "production", JWT_SECRET: "change-me-in-local-env" });
assert.throws(() => loadEnvConfig(), /JWT_SECRET/);

resetEnv({ NODE_ENV: "production", ADMIN_SETUP_TOKEN: "secret" });
assert.throws(() => loadEnvConfig(), /ADMIN_SETUP_TOKEN/);

resetEnv({ DOCUMENT_MAX_SIZE_BYTES: "0" });
assert.throws(() => loadEnvConfig(), /DOCUMENT_MAX_SIZE_BYTES/);

process.env = originalEnv;
