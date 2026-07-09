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
    ...overrides,
  };
}

resetEnv({});
assert.equal(loadEnvConfig().apiPort, 3333);

resetEnv({ NODE_ENV: "production", JWT_SECRET: "change-me-in-local-env" });
assert.throws(() => loadEnvConfig(), /JWT_SECRET/);

resetEnv({ NODE_ENV: "production", ADMIN_SETUP_TOKEN: "secret" });
assert.throws(() => loadEnvConfig(), /ADMIN_SETUP_TOKEN/);

process.env = originalEnv;
