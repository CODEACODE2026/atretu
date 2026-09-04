import assert from "node:assert/strict";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import {
  OperationalRateLimitGuard,
  type OperationalRateLimitPolicy,
  RATE_LIMITS,
} from "./operational-rate-limit.guard.js";
import {
  RateLimitExceededException,
  RateLimitService,
} from "./rate-limit.service.js";

const config = {
  values: {
    authRateLimitTtlMs: 50,
    authRateLimitMax: 2,
    rateLimitMaxBuckets: 100,
  },
};

{
  const guard = createGuard({ ...RATE_LIMITS.pdf, max: 2 });
  assert.equal(
    runGuard(guard, {
      path: "/finance/invoices/00000000-0000-4000-8000-000000000001/bank-slip/pdf",
      userId: "user-a",
    }),
    true,
  );
  assert.equal(
    runGuard(guard, {
      path: "/finance/invoices/00000000-0000-4000-8000-000000000001/bank-slip/pdf",
      userId: "user-a",
    }),
    true,
  );
  assert.throws(
    () =>
      runGuard(guard, {
        path: "/finance/invoices/00000000-0000-4000-8000-000000000002/bank-slip/pdf",
        userId: "user-a",
      }),
    RateLimitExceededException,
  );
  assert.equal(runGuard(guard, { userId: "user-b", route: "/pdf" }), true);
}

{
  const guard = createGuard({ ...RATE_LIMITS.search, max: 2 });
  assert.equal(
    runGuard(guard, {
      path: "/students?search=a",
      userId: "user-a",
    }),
    true,
  );
  assert.equal(
    runGuard(guard, {
      path: "/students?search=b",
      userId: "user-a",
    }),
    true,
  );
  assert.throws(
    () =>
      runGuard(guard, {
        path: "/students?search=c",
        userId: "user-a",
      }),
    RateLimitExceededException,
  );
}

{
  const guard = createGuard(RATE_LIMITS.publicUpload);
  for (let attempt = 0; attempt < RATE_LIMITS.publicUpload.max; attempt += 1) {
    assert.equal(runGuard(guard, { ip: "10.0.0.1", route: "/public" }), true);
  }
  assert.throws(
    () => runGuard(guard, { ip: "10.0.0.1", route: "/public" }),
    RateLimitExceededException,
  );
  assert.equal(runGuard(guard, { ip: "10.0.0.2", route: "/public" }), true);
}

{
  const guard = createGuard({ ...RATE_LIMITS.technical, ttlMs: 20, max: 1 });
  assert.equal(runGuard(guard, { userId: "super-admin", route: "/technical" }), true);
  assert.throws(
    () => runGuard(guard, { userId: "super-admin", route: "/technical" }),
    RateLimitExceededException,
  );
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(runGuard(guard, { userId: "super-admin", route: "/technical" }), true);
}

{
  const pdfGuard = createGuard({ ...RATE_LIMITS.pdf, max: 1 });
  const zipGuard = createGuard({ ...RATE_LIMITS.zip, max: 1 });
  assert.equal(runGuard(pdfGuard, { userId: "user-a", route: "/documents/:id/file" }), true);
  assert.throws(
    () => runGuard(pdfGuard, { userId: "user-a", route: "/documents/:id/file" }),
    RateLimitExceededException,
  );
  assert.equal(
    runGuard(zipGuard, { userId: "user-a", route: "/finance/bank-slip-issue-batches/:batchId/download" }),
    true,
  );
}

{
  const createGuard = createGuardFor({ ...RATE_LIMITS.batchCreate, max: 1 });
  const pollGuard = createGuardFor({ ...RATE_LIMITS.batchPoll, max: 3 });
  assert.equal(
    runGuard(createGuard, {
      method: "POST",
      route: "/finance/bank-slip-issue-batches",
      userId: "user-a",
    }),
    true,
  );
  assert.throws(
    () =>
      runGuard(createGuard, {
        method: "POST",
        route: "/finance/bank-slip-issue-batches",
        userId: "user-a",
      }),
    RateLimitExceededException,
  );
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal(
      runGuard(pollGuard, {
        route: "/finance/bank-slip-issue-batches/:batchId",
        userId: "user-a",
      }),
      true,
    );
  }
}

{
  const searchGuard = createGuard({ ...RATE_LIMITS.search, max: 5 });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(runGuard(searchGuard, { userId: "user-a", route: "/students" }), true);
  }
}

{
  const guard = createGuardFor(undefined);
  assert.equal(runGuard(guard, { userId: "user-a", route: "/unlimited" }), true);
  assert.equal(runGuard(guard, { userId: "user-a", route: "/unlimited" }), true);
  assert.equal(runGuard(guard, { userId: "user-a", route: "/unlimited" }), true);
}

function createGuard(policy: OperationalRateLimitPolicy) {
  return createGuardFor(policy);
}

function createGuardFor(policy: OperationalRateLimitPolicy | undefined) {
  const reflector = {
    getAllAndOverride: () => policy,
  };
  return new OperationalRateLimitGuard(
    new RateLimitService(config as never),
    reflector as unknown as Reflector,
  );
}

function runGuard(
  guard: OperationalRateLimitGuard,
  input: { ip?: string; method?: string; path?: string; route?: string; userId?: string },
) {
  return guard.canActivate({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        ip: input.ip ?? "10.0.0.1",
        method: input.method ?? "GET",
        path: input.path ?? input.route ?? "/unknown",
        route: input.route ? { path: input.route } : undefined,
        user: input.userId ? { id: input.userId } : undefined,
      }),
    }),
  } as unknown as ExecutionContext);
}
