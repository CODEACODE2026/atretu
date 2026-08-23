import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@prisma/client";
import { OperationalPermissionGuard } from "./operational-permission.guard.js";
import {
  OperationalPermission,
  operationalCapabilitiesForRoles,
  SPRINT_OPERATIONAL_PERMISSION_KEYS,
} from "./operational-permissions.js";
import type { AuthUser } from "../users/users.service.js";

class DashboardController {
  @OperationalPermission("dashboard.view")
  handler() {
    return true;
  }
}

class PublicController {
  handler() {
    return true;
  }
}

function executionContext(controller: new () => unknown, user?: AuthUser) {
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    "handler",
  )?.value as () => boolean;
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

function user(input: Partial<AuthUser> & { roles: RoleCode[] }): AuthUser {
  return {
    email: "user@example.com",
    id: "user-1",
    institutionId: null,
    institutionIds: [],
    name: "User",
    status: UserStatus.ACTIVE,
    ...input,
  };
}

function guardWithProfile(profile: unknown) {
  const calls: unknown[] = [];
  const prisma = {
    permissionProfile: {
      findFirst: async (args: unknown) => {
        calls.push(args);
        return profile;
      },
    },
  };
  return {
    calls,
    guard: new OperationalPermissionGuard(new Reflector(), prisma as never),
  };
}

assert.deepEqual(operationalCapabilitiesForRoles([RoleCode.SUPER_ADMIN]), [
  ...SPRINT_OPERATIONAL_PERMISSION_KEYS,
]);
assert.deepEqual(operationalCapabilitiesForRoles([RoleCode.ADMINISTRATOR]), [
  ...SPRINT_OPERATIONAL_PERMISSION_KEYS,
]);
assert.deepEqual(operationalCapabilitiesForRoles([RoleCode.SECRETARIA]), [
  ...SPRINT_OPERATIONAL_PERMISSION_KEYS,
]);
assert.deepEqual(operationalCapabilitiesForRoles([RoleCode.GESTOR]), []);
assert.equal(
  SPRINT_OPERATIONAL_PERMISSION_KEYS.length,
  16,
  "Sprint 15.10F.2C must expose exactly 16 operational capabilities",
);
assert.deepEqual(SPRINT_OPERATIONAL_PERMISSION_KEYS.slice(-3), [
  "studentCards.invalidate",
  "reports.view",
  "reports.export",
]);

assert.equal(
  await guardWithProfile(null).guard.canActivate(
    executionContext(PublicController, user({ roles: [RoleCode.GESTOR] })) as never,
  ),
  true,
);

for (const role of [
  RoleCode.SUPER_ADMIN,
  RoleCode.ADMINISTRATOR,
  RoleCode.SECRETARIA,
]) {
  assert.equal(
    await guardWithProfile(null).guard.canActivate(
      executionContext(DashboardController, user({ roles: [role] })) as never,
    ),
    true,
  );
}

const activeUserGuard = guardWithProfile({
  permissions: [{ permissionKey: "dashboard.view" }],
});
assert.equal(
  await activeUserGuard.guard.canActivate(
    executionContext(
      DashboardController,
      user({ permissionProfileId: "profile-1", roles: [RoleCode.USER] }),
    ) as never,
  ),
  true,
);
assert.deepEqual(activeUserGuard.calls, [
  {
    where: {
      id: "profile-1",
      isActive: true,
    },
    select: {
      permissions: {
        where: {
          permissionKey: { in: ["dashboard.view"] },
        },
        select: { permissionKey: true },
      },
    },
  },
]);

await assert.rejects(
  () =>
    guardWithProfile({ permissions: [] }).guard.canActivate(
      executionContext(
        DashboardController,
        user({ permissionProfileId: "profile-1", roles: [RoleCode.USER] }),
      ) as never,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    guardWithProfile(null).guard.canActivate(
      executionContext(DashboardController, user({ roles: [RoleCode.USER] })) as never,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    guardWithProfile({ permissions: [{ permissionKey: "dashboard.view" }] })
      .guard.canActivate(
        executionContext(DashboardController, user({ roles: [RoleCode.GESTOR] })) as never,
      ),
  (error) => error instanceof ForbiddenException,
);

assert.throws(
  () => OperationalPermission("finance.invoices.view" as never),
  /PermissionKey operacional invalida/,
);

console.log("Operational permission guard OK");
