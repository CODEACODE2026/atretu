import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@prisma/client";
import { getInstitutionScope } from "./institution-scope.js";
import {
  ADMINISTRATOR_PERMISSION_KEYS,
  hasAdministratorPermission,
} from "./administrator-permissions.js";
import { PermissionGuard } from "./permission.guard.js";
import { Permissions } from "./permissions.decorator.js";
import { Roles } from "./roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";
import type { PermissionKey } from "./permission-catalog.js";
import type { AuthUser } from "../users/users.service.js";

const STUDENTS_VIEW = "students.view" satisfies PermissionKey;
const USERS_MANAGE = "users.manage" satisfies PermissionKey;

class PermissionOnlyController {
  @Permissions(STUDENTS_VIEW)
  handler() {
    return true;
  }
}

class UsersManageController {
  @Permissions(USERS_MANAGE)
  handler() {
    return true;
  }
}

class PublicController {
  handler() {
    return true;
  }
}

class AmbiguousController {
  @Roles(RoleCode.SECRETARIA)
  @Permissions(STUDENTS_VIEW)
  handler() {
    return true;
  }
}

class SecretariaOnlyController {
  @Roles(RoleCode.SECRETARIA)
  handler() {
    return true;
  }
}

function executionContext(controller: new () => unknown, user?: AuthUser) {
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    "handler",
  )?.value as () => boolean;
  const request = { user };

  return {
    request,
    context: {
      getClass: () => controller,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    },
  };
}

function user(input: Partial<AuthUser> & { roles: RoleCode[] }): AuthUser {
  return {
    email: "user@example.com",
    id: "user-1",
    institutionIds: [],
    institutionId: null,
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
  return { calls, guard: new PermissionGuard(new Reflector(), prisma as never) };
}

const activeProfileWithPermission = {
  permissions: [{ permissionKey: STUDENTS_VIEW }],
};

const noPermissionGuard = guardWithProfile(null);
assert.equal(
  await noPermissionGuard.guard.canActivate(
    executionContext(PublicController, user({ roles: [RoleCode.USER] }))
      .context as never,
  ),
  true,
);
assert.deepEqual(noPermissionGuard.calls, []);

assert.equal(
  await guardWithProfile(null).guard.canActivate(
    executionContext(
      UsersManageController,
      user({ roles: [RoleCode.SUPER_ADMIN] }),
    ).context as never,
  ),
  true,
);

const activeUserGuard = guardWithProfile(activeProfileWithPermission);
assert.equal(
  await activeUserGuard.guard.canActivate(
    executionContext(
      PermissionOnlyController,
      user({
        permissionProfileId: "profile-1",
        roles: [RoleCode.USER],
      }),
    ).context as never,
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
          permissionKey: { in: [STUDENTS_VIEW] },
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
        PermissionOnlyController,
        user({
          permissionProfileId: "profile-1",
          roles: [RoleCode.USER],
        }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    guardWithProfile(activeProfileWithPermission).guard.canActivate(
      executionContext(
        PermissionOnlyController,
        user({ roles: [RoleCode.USER] }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    guardWithProfile(null).guard.canActivate(
      executionContext(
        PermissionOnlyController,
        user({
          permissionProfileId: "inactive-profile",
          roles: [RoleCode.USER],
        }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

assert.equal(hasAdministratorPermission(STUDENTS_VIEW), true);
assert.equal(hasAdministratorPermission(USERS_MANAGE), false);
assert.equal(
  (ADMINISTRATOR_PERMISSION_KEYS as readonly PermissionKey[]).includes(
    "settings.manage",
  ),
  false,
);
assert.equal(
  (ADMINISTRATOR_PERMISSION_KEYS as readonly PermissionKey[]).includes(
    USERS_MANAGE,
  ),
  false,
);
assert.equal(
  await guardWithProfile(null).guard.canActivate(
    executionContext(
      PermissionOnlyController,
      user({ roles: [RoleCode.ADMINISTRATOR] }),
    ).context as never,
  ),
  true,
);
await assert.rejects(
  () =>
    guardWithProfile(null).guard.canActivate(
      executionContext(
        UsersManageController,
        user({ roles: [RoleCode.ADMINISTRATOR] }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    guardWithProfile(activeProfileWithPermission).guard.canActivate(
      executionContext(
        PermissionOnlyController,
        user({ roles: [RoleCode.SECRETARIA] }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

const rolesGuard = new RolesGuard(new Reflector());
assert.equal(
  rolesGuard.canActivate(
    executionContext(
      SecretariaOnlyController,
      user({ roles: [RoleCode.SECRETARIA] }),
    ).context as never,
  ),
  true,
);
assert.throws(
  () =>
    rolesGuard.canActivate(
      executionContext(
        SecretariaOnlyController,
        user({ roles: [RoleCode.GESTOR] }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    guardWithProfile(activeProfileWithPermission).guard.canActivate(
      executionContext(
        PermissionOnlyController,
        user({ roles: [RoleCode.GESTOR] }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    guardWithProfile(activeProfileWithPermission).guard.canActivate(
      executionContext(
        AmbiguousController,
        user({ roles: [RoleCode.SUPER_ADMIN] }),
      ).context as never,
    ),
  (error) => error instanceof ForbiddenException,
);

assert.throws(
  () => Permissions("legacyImport.access" as PermissionKey),
  /PermissionKey invalida/,
);

const scopedUser = user({
  institutionIds: ["institution-1"],
  institutionId: "institution-1",
  permissionProfileId: "profile-1",
  roles: [RoleCode.USER],
});
const scopedRequest = executionContext(PermissionOnlyController, scopedUser);
assert.equal(
  await guardWithProfile(activeProfileWithPermission).guard.canActivate(
    scopedRequest.context as never,
  ),
  true,
);
assert.deepEqual(scopedRequest.request.user?.institutionIds, ["institution-1"]);
assert.deepEqual(getInstitutionScope(scopedUser), { type: "denied" });

console.log("Permission guard foundation OK");
