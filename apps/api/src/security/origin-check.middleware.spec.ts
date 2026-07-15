import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { createOriginCheckMiddleware } from "./origin-check.middleware.js";

const middleware = createOriginCheckMiddleware(["http://localhost:3000"]);

assert.doesNotThrow(() =>
  run({ method: "GET", headers: { origin: "https://evil.test" } }),
);
assert.doesNotThrow(() =>
  run({ method: "POST", headers: { origin: "http://localhost:3000" } }),
);
assert.doesNotThrow(() =>
  run({ method: "POST", headers: { referer: "http://localhost:3000/admin" } }),
);
assert.throws(
  () => run({ method: "POST", headers: { origin: "https://evil.test" } }),
  ForbiddenException,
);
assert.throws(
  () => run({ method: "PATCH", headers: { origin: "https://evil.test" } }),
  ForbiddenException,
);
assert.throws(
  () => run({ method: "DELETE", headers: { "user-agent": "Mozilla/5.0" } }),
  ForbiddenException,
);
assert.doesNotThrow(() => run({ method: "POST", headers: { "user-agent": "undici" } }));

function run(input: { method: string; headers: Record<string, string> }) {
  let called = false;
  middleware(
    input as never,
    {} as never,
    () => {
      called = true;
    },
  );
  assert.equal(called, true);
}
