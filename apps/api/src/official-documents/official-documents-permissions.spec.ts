import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OfficialDocumentModelStatus, RoleCode, UserStatus } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import type { SprintOperationalPermissionKey } from "../auth/operational-permissions.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  InstitutionalOfficialDocumentsController,
  OfficialDocumentIssuesController,
  OfficialDocumentModelsController,
  OfficialDocumentsController,
} from "./official-documents.controller.js";
import { OfficialDocumentsService } from "./official-documents.service.js";

const GUARDS_METADATA_KEY = "__guards__";

const endpointPermissions = [
  ["listOfficialDocuments", ["officialDocuments.view"]],
  ["listStudentModelIssues", ["officialDocuments.view"]],
  ["previewDynamicDocument", ["officialDocuments.issue"]],
  ["issueDynamicDocument", ["officialDocuments.issue"]],
  ["issueOfficialDocument", ["officialDocuments.issue"]],
  ["reissueOfficialDocument", ["officialDocuments.issue"]],
  ["getOfficialDocumentIssue", ["officialDocuments.view"]],
  ["getOfficialDocumentFile", ["officialDocuments.view"]],
] as const satisfies ReadonlyArray<
  readonly [keyof OfficialDocumentsController, readonly SprintOperationalPermissionKey[]]
>;

const issueEndpointPermissions = [
  ["listIssues", ["officialDocuments.view"]],
] as const satisfies ReadonlyArray<
  readonly [keyof OfficialDocumentIssuesController, readonly SprintOperationalPermissionKey[]]
>;

const institutionalEndpointPermissions = [
  ["issueInstitutionalOfficialDocument", [RoleCode.SUPER_ADMIN]],
  ["reissueInstitutionalOfficialDocument", [RoleCode.SUPER_ADMIN]],
] as const satisfies ReadonlyArray<
  readonly [
    keyof InstitutionalOfficialDocumentsController,
    readonly RoleCode[],
  ]
>;

await testControllerUsesOperationalGuard();
await testUserViewPermissions();
await testUserIssuePermissions();
await testUserWithoutPermissionIsDenied();
await testFixedRolesAndGestorPolicy();
await testModelsManageRemainsRoleGuarded();
await testIssueUsersMayOnlyListActiveModelsForIssuing();
await testIssueListingInstitutionScope();

async function testControllerUsesOperationalGuard() {
  for (const controller of [
    OfficialDocumentsController,
    OfficialDocumentIssuesController,
  ]) {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA_KEY, controller), [
      AuthGuard,
      OperationalPermissionGuard,
    ]);
  }

  for (const [method, permissions] of endpointPermissions) {
    assert.deepEqual(
      Reflect.getMetadata(
        "operationalPermissions",
        OfficialDocumentsController.prototype[method],
      ),
      permissions,
      `${String(method)} must use the approved OfficialDocuments permission`,
    );
  }

  for (const [method, permissions] of issueEndpointPermissions) {
    assert.deepEqual(
      Reflect.getMetadata(
        "operationalPermissions",
        OfficialDocumentIssuesController.prototype[method],
      ),
      permissions,
    );
  }

  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA_KEY, InstitutionalOfficialDocumentsController),
    [AuthGuard, RolesGuard],
  );
  assert.deepEqual(
    Reflect.getMetadata("roles", InstitutionalOfficialDocumentsController),
    [RoleCode.SUPER_ADMIN, RoleCode.ADMINISTRATOR, RoleCode.SECRETARIA],
  );
  for (const [method, roles] of institutionalEndpointPermissions) {
    assert.deepEqual(
      Reflect.getMetadata(
        "roles",
        InstitutionalOfficialDocumentsController.prototype[method],
      ),
      roles,
      `${String(method)} must remain SUPER_ADMIN-only`,
    );
  }
}

async function testUserViewPermissions() {
  const guard = guardWithProfile(["officialDocuments.view"]);
  for (const method of [
    "listOfficialDocuments",
    "listStudentModelIssues",
    "getOfficialDocumentIssue",
    "getOfficialDocumentFile",
  ] as const) {
    assert.equal(await guard.canActivate(context(method, operationalUser())), true);
  }
  for (const method of [
    "previewDynamicDocument",
    "issueDynamicDocument",
    "issueOfficialDocument",
    "reissueOfficialDocument",
  ] as const) {
    await assert.rejects(
      () => guard.canActivate(context(method, operationalUser())),
      (error) => error instanceof ForbiddenException,
      `USER with view must not execute ${method}`,
    );
  }
}

async function testUserIssuePermissions() {
  const guard = guardWithProfile([
    "officialDocuments.view",
    "officialDocuments.issue",
  ]);
  for (const method of [
    "previewDynamicDocument",
    "issueDynamicDocument",
    "issueOfficialDocument",
    "reissueOfficialDocument",
  ] as const) {
    assert.equal(await guard.canActivate(context(method, operationalUser())), true);
  }
}

async function testUserWithoutPermissionIsDenied() {
  const guard = guardWithProfile([]);
  await assert.rejects(
    () => guard.canActivate(context("listOfficialDocuments", operationalUser())),
    (error) => error instanceof ForbiddenException,
    "USER without officialDocuments.view must receive 403",
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
        context("issueOfficialDocument", operationalUser({ roles: [role] })),
      ),
      true,
      `${role} must keep fixed OfficialDocuments access without PermissionProfile`,
    );
  }
  await assert.rejects(
    () =>
      guard.canActivate(
        context(
          "listOfficialDocuments",
          operationalUser({ roles: [RoleCode.GESTOR] }),
        ),
      ),
    (error) => error instanceof ForbiddenException,
    "GESTOR must not gain OfficialDocuments access",
  );
}

async function testModelsManageRemainsRoleGuarded() {
  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA_KEY, OfficialDocumentModelsController),
    [AuthGuard, RolesGuard],
  );
  assert.deepEqual(
    Reflect.getMetadata("roles", OfficialDocumentModelsController),
    [RoleCode.SUPER_ADMIN, RoleCode.ADMINISTRATOR, RoleCode.SECRETARIA],
  );
  assert.equal(
    Reflect.getMetadata(
      "operationalPermissions",
      OfficialDocumentModelsController.prototype.createModel,
    ),
    undefined,
  );
}

async function testIssueUsersMayOnlyListActiveModelsForIssuing() {
  assert.deepEqual(
    Reflect.getMetadata("roles", OfficialDocumentModelsController.prototype.listModels),
    [],
    "listModels must override the class role gate for issuing users",
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "operationalPermissions",
      OfficialDocumentModelsController.prototype.listModels,
    ),
    ["officialDocuments.issue"],
  );

  const rolesGuard = new RolesGuard(new Reflector());
  assert.equal(
    rolesGuard.canActivate(
      modelContext("listModels", operationalUser({ roles: [RoleCode.USER] })),
    ),
    true,
    "USER with issue must pass the read-only model list role override",
  );

  const guard = guardWithProfile([
    "officialDocuments.view",
    "officialDocuments.issue",
  ]);
  assert.equal(
    await guard.canActivate(modelContext("listModels", operationalUser())),
    true,
  );

  const controller = new OfficialDocumentModelsController({
    listModels: (status: unknown) => ({ status }),
  } as never);
  assert.deepEqual(
    controller.listModels(OfficialDocumentModelStatus.ACTIVE, operationalUser()),
    { status: OfficialDocumentModelStatus.ACTIVE },
  );
  assert.throws(
    () => controller.listModels(undefined, operationalUser()),
    (error) => error instanceof ForbiddenException,
    "USER issue must not list every model status",
  );
}

function modelContext(
  method: keyof OfficialDocumentModelsController,
  user: AuthUser,
) {
  return {
    getClass: () => OfficialDocumentModelsController,
    getHandler: () => OfficialDocumentModelsController.prototype[method],
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

async function testIssueListingInstitutionScope() {
  const prisma = issueListPrisma();
  const service = new OfficialDocumentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  await service.listIssues({ page: 1, limit: 20 }, operationalUser());
  assert.deepEqual(prisma.issueFindManyWhere.at(-1), {
    student: { enrollments: { some: { institutionId: "institution-a" } } },
  });

  await service.listIssues(
    { page: 1, limit: 20 },
    operationalUser({ institutionIds: ["institution-b"] }),
  );
  assert.deepEqual(prisma.issueFindManyWhere.at(-1), {
    student: { enrollments: { some: { institutionId: "institution-b" } } },
  });

  await service.listIssues(
    { page: 1, limit: 20 },
    operationalUser({ roles: [RoleCode.ADMINISTRATOR], institutionIds: [] }),
  );
  assert.deepEqual(prisma.issueFindManyWhere.at(-1), {});
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
    email: "official-documents-user@example.com",
    id: "user-1",
    institutionId: null,
    institutionIds: ["institution-a"],
    name: "Official Documents User",
    permissionProfileId: "profile-1",
    roles: [RoleCode.USER],
    status: UserStatus.ACTIVE,
    ...input,
  };
}

function context(method: keyof OfficialDocumentsController, user: AuthUser) {
  return {
    getClass: () => OfficialDocumentsController,
    getHandler: () => OfficialDocumentsController.prototype[method],
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

function issueListPrisma() {
  const issueFindManyWhere: unknown[] = [];
  return {
    issueFindManyWhere,
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    officialDocumentIssue: {
      count: async () => 0,
      findMany: async (args: { where: unknown }) => {
        issueFindManyWhere.push(args.where);
        return [];
      },
    },
  };
}

console.log("Official documents operational permissions OK");
