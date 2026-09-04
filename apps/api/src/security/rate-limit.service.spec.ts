import assert from "node:assert/strict";
import { HttpException } from "@nestjs/common";
import {
  RateLimitExceededException,
  RateLimitService,
} from "./rate-limit.service.js";

const config = {
  values: {
    authRateLimitTtlMs: 50,
    authRateLimitMax: 2,
    rateLimitMaxBuckets: 2,
  },
};

const service = new RateLimitService(config as never);

service.assertAllowed("login:ip-1:user@example.com");
service.assertAllowed("login:ip-1:user@example.com");
assert.throws(
  () => service.assertAllowed("login:ip-1:user@example.com"),
  HttpException,
);
assert.throws(
  () => service.assertAllowed("login:ip-1:user@example.com"),
  (error) =>
    error instanceof RateLimitExceededException &&
    error.getStatus() === 429 &&
    error.retryAfterSeconds > 0,
);
service.reset("login:ip-1:user@example.com");
assert.doesNotThrow(() => service.assertAllowed("login:ip-1:user@example.com"));

await new Promise((resolve) => setTimeout(resolve, 60));
service.assertAllowed("bootstrap:ip-1");
assert.equal(service.size, 1);

service.assertAllowed("pre-registration:ip-1:cpf-1");
service.assertAllowed("pre-registration:ip-2:cpf-2");
assert.equal(service.size, 2);

const customService = new RateLimitService(config as never);
customService.assertAllowed("zip:user-1", { max: 1, ttlMs: 20 });
assert.throws(
  () => customService.assertAllowed("zip:user-1", { max: 1, ttlMs: 20 }),
  RateLimitExceededException,
);
assert.doesNotThrow(() =>
  customService.assertAllowed("zip:user-2", { max: 1, ttlMs: 20 }),
);
await new Promise((resolve) => setTimeout(resolve, 25));
assert.doesNotThrow(() =>
  customService.assertAllowed("zip:user-1", { max: 1, ttlMs: 20 }),
);
