import assert from "node:assert/strict";
import { loadSicrediConfig } from "./sicredi-config.js";

const baseEnv = {
  SICREDI_ENV: "sandbox",
  SICREDI_AUTH_URL: "https://api-parceiro.sicredi.com.br/sb/auth/openapi/token",
  SICREDI_BASE_URL: "https://api-parceiro.sicredi.com.br/sb",
  SICREDI_API_KEY: "api-key",
  SICREDI_USERNAME: "123456789",
  SICREDI_PASSWORD: "password",
  SICREDI_COOPERATIVA: "6789",
  SICREDI_POSTO: "03",
  SICREDI_CODIGO_BENEFICIARIO: "12345",
  SICREDI_HTTP_TIMEOUT_MS: "15000",
  SICREDI_REQUIRE_PAYER_ADDRESS: "true",
};

const config = loadSicrediConfig(baseEnv);
assert.equal(config.environment, "sandbox");
assert.equal(config.timeoutMs, 15000);
assert.equal(config.requirePayerAddress, true);
assert.equal(config.cooperativa, "6789");

assert.throws(
  () => loadSicrediConfig({ ...baseEnv, SICREDI_ENV: "homologation" }),
  /SICREDI_ENV/,
);
assert.throws(
  () => loadSicrediConfig({ ...baseEnv, SICREDI_PASSWORD: "" }),
  /SICREDI_PASSWORD/,
);
assert.throws(
  () => loadSicrediConfig({ ...baseEnv, SICREDI_API_KEY: "" }),
  /SICREDI_API_KEY/,
);
assert.throws(
  () => loadSicrediConfig({ ...baseEnv, SICREDI_COOPERATIVA: "123" }),
  /SICREDI_COOPERATIVA/,
);
assert.throws(
  () => loadSicrediConfig({ ...baseEnv, SICREDI_AUTH_URL: "not-a-url" }),
  /SICREDI_AUTH_URL/,
);
