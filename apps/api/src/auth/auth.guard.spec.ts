import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@prisma/client";
import { AllowDuringPasswordChange } from "./allow-during-password-change.decorator.js";
import { AuthGuard } from "./auth.guard.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "./roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";

function context(token = "token") {
  const request: {
    cookies: Record<string, string>;
    headers: { authorization: string };
    user?: typeof activeUser;
  } = {
    cookies: {},
    headers: { authorization: `Bearer ${token}` },
  };
  return {
    request,
    executionContext: {
      getClass: () => class TestController {},
      getHandler: () => function testHandler() {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    },
  };
}

const activeUser = {
  id: "user-1",
  name: "Admin",
  email: "admin@example.com",
  status: UserStatus.ACTIVE,
  roles: [RoleCode.SUPER_ADMIN],
  passwordChangedAt: new Date("2026-08-05T13:00:00.000Z"),
};

const authService = {
  verifyToken: async () => ({
    email: activeUser.email,
    iat: Math.floor(new Date("2026-08-05T13:00:02.000Z").getTime() / 1000),
    roles: activeUser.roles,
    sub: activeUser.id,
  }),
};

const usersService = {
  findAuthUserById: async () => activeUser,
};

const guard = new AuthGuard(authService as never, usersService as never);
const valid = context();
assert.equal(await guard.canActivate(valid.executionContext as never), true);
assert.equal(valid.request.user?.id, activeUser.id);

const passwordChangeGuard = new AuthGuard(
  authService as never,
  {
    findAuthUserById: async () => ({
      ...activeUser,
      mustChangePassword: true,
    }),
  } as never,
  new Reflector(),
);
await assert.rejects(
  () => passwordChangeGuard.canActivate(context().executionContext as never),
  (error) => error instanceof ForbiddenException,
);

class AccountController {
  @AllowDuringPasswordChange()
  changePassword() {
    return true;
  }
}
const allowedHandler = Object.getOwnPropertyDescriptor(
  AccountController.prototype,
  "changePassword",
)?.value as () => boolean;
const allowedContext = context().executionContext as unknown as {
  getClass: () => typeof AccountController;
  getHandler: () => () => boolean;
};
allowedContext.getClass = () => AccountController;
allowedContext.getHandler = () => allowedHandler;
assert.equal(await passwordChangeGuard.canActivate(allowedContext as never), true);

const inactiveGuard = new AuthGuard(authService as never, {
  findAuthUserById: async () => ({ ...activeUser, status: UserStatus.INACTIVE }),
} as never);
await assert.rejects(
  () => inactiveGuard.canActivate(context().executionContext as never),
  (error) => error instanceof UnauthorizedException,
);

const oldTokenGuard = new AuthGuard(
  {
    verifyToken: async () => ({
      email: activeUser.email,
      iat: Math.floor(new Date("2026-08-05T12:59:58.000Z").getTime() / 1000),
      roles: activeUser.roles,
      sub: activeUser.id,
    }),
  } as never,
  usersService as never,
);
await assert.rejects(
  () => oldTokenGuard.canActivate(context().executionContext as never),
  (error) => error instanceof UnauthorizedException,
);

const changedPasswordClaimGuard = new AuthGuard(
  {
    verifyToken: async () => ({
      email: activeUser.email,
      iat: Math.floor(new Date("2026-08-05T13:00:02.000Z").getTime() / 1000),
      passwordChangedAt: new Date("2026-08-05T12:59:59.000Z").getTime(),
      roles: activeUser.roles,
      sub: activeUser.id,
    }),
  } as never,
  usersService as never,
);
await assert.rejects(
  () => changedPasswordClaimGuard.canActivate(context().executionContext as never),
  (error) => error instanceof UnauthorizedException,
);

class AdminOnlyController {
  @Roles(RoleCode.SUPER_ADMIN)
  handler() {
    return true;
  }
}

class OperationalAdminController {
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  handler() {
    return true;
  }
}

const rolesGuard = new RolesGuard(new Reflector());
const handler = Object.getOwnPropertyDescriptor(
  AdminOnlyController.prototype,
  "handler",
)?.value as () => boolean;

const rolesContext = {
  getClass: () => AdminOnlyController,
  getHandler: () => handler,
  switchToHttp: () => ({
    getRequest: () => ({
      user: {
        ...activeUser,
        roles: [RoleCode.GESTOR],
      },
    }),
  }),
};
assert.throws(() => rolesGuard.canActivate(rolesContext as never));

const operationalHandler = Object.getOwnPropertyDescriptor(
  OperationalAdminController.prototype,
  "handler",
)?.value as () => boolean;

for (const role of OPERATIONAL_ADMIN_ROLES) {
  const operationalContext = {
    getClass: () => OperationalAdminController,
    getHandler: () => operationalHandler,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          ...activeUser,
          permissionProfileId: null,
          roles: [role],
        },
      }),
    }),
  };
  assert.equal(rolesGuard.canActivate(operationalContext as never), true);
}

for (const role of [RoleCode.USER, RoleCode.GESTOR]) {
  const blockedOperationalContext = {
    getClass: () => OperationalAdminController,
    getHandler: () => operationalHandler,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          ...activeUser,
          permissionProfileId: null,
          roles: [role],
        },
      }),
    }),
  };
  assert.throws(() => rolesGuard.canActivate(blockedOperationalContext as never));
}
