import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import type { SprintOperationalPermissionKey } from "../auth/operational-permissions.js";
import type { AuthUser } from "../users/users.service.js";
import { StudentCardsController } from "./student-cards.controller.js";

const GUARDS_METADATA_KEY = "__guards__";

const endpointPermissions = [
  ["listStudentCards", ["studentCards.view"]],
  ["listStudentCardsForStudent", ["studentCards.view"]],
  ["listPendingStudentCards", ["studentCards.view"]],
  ["getStudentCardPdf", ["studentCards.view"]],
  ["previewStudentCard", ["studentCards.view"]],
  ["issueStudentCard", ["studentCards.issue"]],
  ["printStudentCardsBatch", ["studentCards.issue"]],
  ["invalidateStudentCard", ["studentCards.invalidate"]],
] as const satisfies ReadonlyArray<
  readonly [keyof StudentCardsController, readonly SprintOperationalPermissionKey[]]
>;

await testControllerUsesOperationalGuard();
await testUserViewPermissions();
await testUserIssuePermissions();
await testUserInvalidatePermissions();
await testUserWithoutPermissionIsDenied();
await testFixedRolesAndGestorPolicy();

async function testControllerUsesOperationalGuard() {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA_KEY, StudentCardsController), [
    AuthGuard,
    OperationalPermissionGuard,
  ]);
  for (const [method, permissions] of endpointPermissions) {
    assert.deepEqual(
      Reflect.getMetadata(
        "operationalPermissions",
        StudentCardsController.prototype[method],
      ),
      permissions,
      `${String(method)} must use its approved StudentCards permission`,
    );
  }
}

async function testUserViewPermissions() {
  const guard = guardWithProfile(["studentCards.view"]);
  for (const method of [
    "listStudentCards",
    "listStudentCardsForStudent",
    "listPendingStudentCards",
    "getStudentCardPdf",
    "previewStudentCard",
  ] as const) {
    assert.equal(
      await guard.canActivate(context(method, operationalUser())),
      true,
      `${method} must allow USER with studentCards.view`,
    );
  }
  await assert.rejects(
    () => guard.canActivate(context("issueStudentCard", operationalUser())),
    (error) => error instanceof ForbiddenException,
    "USER with view must not issue",
  );
  await assert.rejects(
    () => guard.canActivate(context("printStudentCardsBatch", operationalUser())),
    (error) => error instanceof ForbiddenException,
    "USER with view must not print batch",
  );
  await assert.rejects(
    () => guard.canActivate(context("invalidateStudentCard", operationalUser())),
    (error) => error instanceof ForbiddenException,
    "USER with view must not invalidate",
  );
}

async function testUserIssuePermissions() {
  const guard = guardWithProfile(["studentCards.view", "studentCards.issue"]);
  assert.equal(
    await guard.canActivate(context("issueStudentCard", operationalUser())),
    true,
  );
  assert.equal(
    await guard.canActivate(context("printStudentCardsBatch", operationalUser())),
    true,
  );
  await assert.rejects(
    () => guard.canActivate(context("invalidateStudentCard", operationalUser())),
    (error) => error instanceof ForbiddenException,
    "USER with issue but without invalidate must not invalidate",
  );
}

async function testUserInvalidatePermissions() {
  const guard = guardWithProfile([
    "studentCards.view",
    "studentCards.invalidate",
  ]);
  assert.equal(
    await guard.canActivate(context("invalidateStudentCard", operationalUser())),
    true,
  );
  await assert.rejects(
    () => guard.canActivate(context("issueStudentCard", operationalUser())),
    (error) => error instanceof ForbiddenException,
    "USER with invalidate but without issue must not issue",
  );
}

async function testUserWithoutPermissionIsDenied() {
  const guard = guardWithProfile([]);
  await assert.rejects(
    () => guard.canActivate(context("listStudentCards", operationalUser())),
    (error) => error instanceof ForbiddenException,
    "USER without studentCards.view must receive 403",
  );
}

async function testFixedRolesAndGestorPolicy() {
  const guard = guardWithProfile([]);
  for (const role of [
    RoleCode.SUPER_ADMIN,
    RoleCode.ADMINISTRATOR,
    RoleCode.SECRETARIA,
  ]) {
    assert.equal(
      await guard.canActivate(
        context("issueStudentCard", operationalUser({ roles: [role] })),
      ),
      true,
      `${role} must keep fixed StudentCards access without PermissionProfile`,
    );
  }
  await assert.rejects(
    () =>
      guard.canActivate(
        context("listStudentCards", operationalUser({ roles: [RoleCode.GESTOR] })),
      ),
    (error) => error instanceof ForbiddenException,
    "GESTOR must not gain StudentCards access",
  );
}

function guardWithProfile(permissions: SprintOperationalPermissionKey[]) {
  const prisma = {
    permissionProfile: {
      findFirst: async () => ({
        permissions: permissions.map((permissionKey) => ({ permissionKey })),
      }),
    },
  };
  return new OperationalPermissionGuard(new Reflector(), prisma as never);
}

function operationalUser(input: Partial<AuthUser> = {}): AuthUser {
  return {
    email: "student-cards-user@example.com",
    id: "user-1",
    institutionId: null,
    institutionIds: ["institution-a"],
    name: "Student Cards User",
    permissionProfileId: "profile-1",
    roles: [RoleCode.USER],
    status: UserStatus.ACTIVE,
    ...input,
  };
}

function context(method: keyof StudentCardsController, user: AuthUser) {
  return {
    getClass: () => StudentCardsController,
    getHandler: () => StudentCardsController.prototype[method],
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

console.log("Student cards operational permissions OK");
