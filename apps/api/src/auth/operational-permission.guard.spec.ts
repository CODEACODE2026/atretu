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

class FinanceInvoicesController {
  @OperationalPermission("finance.invoices.view")
  handler() {
    return true;
  }
}

class FinanceInvoicesManageController {
  @OperationalPermission("finance.invoices.manage")
  handler() {
    return true;
  }
}

class CollectionsViewController {
  @OperationalPermission("collections.view")
  handler() {
    return true;
  }
}

class CollectionsManageController {
  @OperationalPermission("collections.manage")
  handler() {
    return true;
  }
}

class ManualMovementsViewController {
  @OperationalPermission("manualMovements.view")
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
  24,
  "Sprint 15.10F.2G.4 must expose exactly 24 operational capabilities",
);
assert.ok(SPRINT_OPERATIONAL_PERMISSION_KEYS.includes("finance.invoices.view"));
assert.ok(SPRINT_OPERATIONAL_PERMISSION_KEYS.includes("finance.invoices.manage"));
assert.ok(SPRINT_OPERATIONAL_PERMISSION_KEYS.includes("collections.view"));
assert.ok(SPRINT_OPERATIONAL_PERMISSION_KEYS.includes("collections.manage"));
assert.ok(SPRINT_OPERATIONAL_PERMISSION_KEYS.includes("manualMovements.view"));
assert.equal(
  SPRINT_OPERATIONAL_PERMISSION_KEYS.indexOf("finance.invoices.manage"),
  SPRINT_OPERATIONAL_PERMISSION_KEYS.indexOf("finance.invoices.view") + 1,
);
assert.equal(
  SPRINT_OPERATIONAL_PERMISSION_KEYS.indexOf("collections.manage"),
  SPRINT_OPERATIONAL_PERMISSION_KEYS.indexOf("collections.view") + 1,
);

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

assert.equal(
  await guardWithProfile({
    permissions: [{ permissionKey: "finance.invoices.view" }],
  }).guard.canActivate(
    executionContext(
      FinanceInvoicesController,
      user({ permissionProfileId: "profile-1", roles: [RoleCode.USER] }),
    ) as never,
  ),
  true,
);
assert.equal(
  await guardWithProfile({
    permissions: [{ permissionKey: "finance.invoices.manage" }],
  }).guard.canActivate(
    executionContext(
      FinanceInvoicesManageController,
      user({ permissionProfileId: "profile-1", roles: [RoleCode.USER] }),
    ) as never,
  ),
  true,
);
assert.equal(
  await guardWithProfile({
    permissions: [{ permissionKey: "collections.view" }],
  }).guard.canActivate(
    executionContext(
      CollectionsViewController,
      user({ permissionProfileId: "profile-1", roles: [RoleCode.USER] }),
    ) as never,
  ),
  true,
);
assert.equal(
  await guardWithProfile({
    permissions: [{ permissionKey: "collections.manage" }],
  }).guard.canActivate(
    executionContext(
      CollectionsManageController,
      user({ permissionProfileId: "profile-1", roles: [RoleCode.USER] }),
    ) as never,
  ),
  true,
);
assert.equal(
  await guardWithProfile({
    permissions: [{ permissionKey: "manualMovements.view" }],
  }).guard.canActivate(
    executionContext(
      ManualMovementsViewController,
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

for (const inactiveFinancePermission of [
  "finance.bankSlips.manage",
  "manualMovements.manage",
] as const) {
  assert.throws(
    () => OperationalPermission(inactiveFinancePermission as never),
    /PermissionKey operacional invalida/,
  );
}

console.log("Operational permission guard OK");
