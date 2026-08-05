import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync(new URL("./auth.controller.ts", import.meta.url), "utf8");

assert.match(controller, /@Post\("bootstrap\/super-admin"\)/);
assert.doesNotMatch(controller, /@Post\("users"\)/);
assert.doesNotMatch(controller, /@Put\("users\/:id\/institutions"\)/);
assert.doesNotMatch(controller, /createAdministrativeUser/);
