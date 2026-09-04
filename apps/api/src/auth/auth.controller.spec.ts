import assert from "node:assert/strict";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { authCookieOptions, clearAuthCookieOptions } from "./auth-cookie.js";
import { AUTH_COOKIE_NAME } from "./auth.constants.js";

const strongSetupToken = "test-admin-token-with-more-than-thirty-two-characters";
const user = {
  id: "user-id",
  name: "Admin",
  email: "admin@example.com",
  status: "ACTIVE",
  roles: ["SUPER_ADMIN"],
};

assert.deepEqual(authCookieOptions("production"), {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
  maxAge: 7_200_000,
});
assert.deepEqual(clearAuthCookieOptions("production"), {
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  path: "/",
});
assert.equal(authCookieOptions("development").secure, false);

{
  const controller = createController({ adminBootstrapEnabled: false });
  await assert.rejects(
    () =>
      controller.bootstrapSuperAdmin(
        bootstrapBody(),
        strongSetupToken,
        request() as never,
      ),
    NotFoundException,
  );
  assert.equal(controller.calls.created, 0);
  assert.equal(controller.calls.rateLimit, 1);
}

{
  const controller = createController({ adminBootstrapEnabled: true });
  await assert.rejects(
    () =>
      controller.bootstrapSuperAdmin(
        bootstrapBody(),
        "wrong-token",
        request() as never,
      ),
    ForbiddenException,
  );
  assert.equal(controller.calls.created, 0);
}

{
  const controller = createController({ adminBootstrapEnabled: true });
  await assert.rejects(
    () =>
      controller.bootstrapSuperAdmin(bootstrapBody(), undefined, request() as never),
    ForbiddenException,
  );
  assert.equal(controller.calls.created, 0);
}

{
  const controller = createController({ adminBootstrapEnabled: true });
  const result = await controller.bootstrapSuperAdmin(
    bootstrapBody(),
    strongSetupToken,
    request() as never,
  );
  assert.deepEqual(result, { user });
  assert.equal(controller.calls.created, 1);
  assert.equal(controller.calls.audit, 1);
}

{
  const controller = createController({
    adminBootstrapEnabled: true,
    existingSuperAdmin: true,
  });
  await assert.rejects(
    () =>
      controller.bootstrapSuperAdmin(
        bootstrapBody(),
        strongSetupToken,
        request() as never,
      ),
    ConflictException,
  );
}

{
  const controller = createController({ adminBootstrapEnabled: true });
  const response = cookieResponse();
  await controller.login(
    { email: "Admin@Example.com", password: "SenhaForte#123" },
    request() as never,
    response as never,
  );
  assert.equal(response.cookieName, AUTH_COOKIE_NAME);
  assert.equal(response.cookieValue, "signed-token");
  assert.equal(response.cookieOptions.httpOnly, true);
  assert.equal(response.cookieOptions.secure, true);
  assert.equal(response.cookieOptions.sameSite, "lax");
  assert.equal(response.cookieOptions.path, "/");
}

function createController(input: {
  adminBootstrapEnabled: boolean;
  existingSuperAdmin?: boolean;
}) {
  const calls = { audit: 0, created: 0, rateLimit: 0 };
  const config = {
    values: {
      nodeEnv: "production",
      adminBootstrapEnabled: input.adminBootstrapEnabled,
      adminSetupToken: strongSetupToken,
    },
  };
  const authService = {
    validateCredentials: async () => user,
    signToken: async () => "signed-token",
    createFirstSuperAdmin: async () => {
      if (input.existingSuperAdmin) {
        throw new ConflictException("Super Admin inicial ja existe");
      }
      calls.created += 1;
      return user;
    },
  };
  const audit = {
    record: async () => {
      calls.audit += 1;
    },
  };
  const rateLimit = {
    assertAllowed: () => {
      calls.rateLimit += 1;
    },
    reset: () => undefined,
  };
  const usersService = {
    withOperationalCapabilities: async () => user,
  };
  const controller = new AuthController(
    authService as never,
    audit as never,
    config as never,
    rateLimit as never,
    usersService as never,
  ) as AuthController & { calls: typeof calls };
  controller.calls = calls;
  return controller;
}

function bootstrapBody() {
  return {
    name: "Admin",
    email: "admin@example.com",
    password: "SenhaForte#123",
  };
}

function request() {
  return {
    ip: "127.0.0.1",
    headers: { "user-agent": "test" },
  };
}

function cookieResponse() {
  const response: {
    cookieName: string;
    cookieValue: string;
    cookieOptions: Record<string, unknown>;
    cookie(name: string, value: string, options: Record<string, unknown>): void;
  } = {
    cookieName: "",
    cookieValue: "",
    cookieOptions: {},
    cookie(name: string, value: string, options: Record<string, unknown>) {
      this.cookieName = name;
      this.cookieValue = value;
      this.cookieOptions = options;
    },
  };
  return response;
}
