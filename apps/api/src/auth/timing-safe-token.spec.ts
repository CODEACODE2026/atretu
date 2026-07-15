import assert from "node:assert/strict";
import { timingSafeStringEqual } from "./timing-safe-token.js";

const expected = "test-admin-token-with-more-than-thirty-two-characters";

assert.equal(timingSafeStringEqual(expected, expected), true);
assert.equal(
  timingSafeStringEqual("test-admin-token-with-more-than-thirty-two-characterx", expected),
  false,
);
assert.equal(timingSafeStringEqual("short", expected), false);
assert.equal(timingSafeStringEqual(undefined, expected), false);
