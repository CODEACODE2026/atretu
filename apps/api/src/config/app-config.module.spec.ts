import assert from "node:assert/strict";
import { sep } from "node:path";
import {
  API_ENV_FILE_PATH,
  shouldIgnoreApiEnvFile,
} from "./app-config.module.js";

assert.equal(
  API_ENV_FILE_PATH.endsWith(`${sep}apps${sep}api${sep}.env`),
  true,
);
assert.equal(shouldIgnoreApiEnvFile("development"), false);
assert.equal(shouldIgnoreApiEnvFile("test"), false);
assert.equal(shouldIgnoreApiEnvFile("production"), true);
