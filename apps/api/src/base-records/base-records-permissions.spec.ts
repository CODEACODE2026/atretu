import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode, UserStatus } from "@prisma/client";
import { BaseRecordsController } from "./base-records.controller.js";
import { BusAssignmentsController } from "../bus-assignments/bus-assignments.controller.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import {
  OPERATIONAL_PERMISSIONS_KEY,
  type SprintOperationalPermissionKey,
} from "../auth/operational-permissions.js";
import {
  GLOBAL_OPERATIONAL_ADMIN_ROLES,
  OPERATIONAL_ADMIN_ROLES,
} from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";

const ROLES_METADATA_KEY = "roles";

const auxiliaryReadEndpoints = [
  "listInstitutions",
  "listShifts",
  "listBuses",
] as const;
const baseRecordsViewEndpoints = [
  "getInstitution",
  "getShift",
  "getBus",
] as const;
const institutionalAdminWriteEndpoints = [
  "createInstitution",
  "updateInstitution",
  "inactivateInstitution",
  "reactivateInstitution",
] as const;
const globalAdminWriteEndpoints = [
  "createShift",
  "updateShift",
  "inactivateShift",
  "reactivateShift",
  "createBus",
  "updateBus",
  "inactivateBus",
  "reactivateBus",
] as const;
const adminWriteEndpoints = [
  ...institutionalAdminWriteEndpoints,
  ...globalAdminWriteEndpoints,
] as const;

for (const endpoint of auxiliaryReadEndpoints) {
  assert.deepEqual(rolesMetadata(BaseRecordsController, endpoint), []);
  assert.deepEqual(
    operationalPermissions(BaseRecordsController, endpoint),
    endpoint === "listInstitutions"
      ? [
          "students.view",
          "reports.view",
          "baseRecords.view",
          "finance.invoices.view",
          "collections.view",
        ]
      : ["students.view", "reports.view", "baseRecords.view"],
  );
}

for (const endpoint of baseRecordsViewEndpoints) {
  assert.deepEqual(rolesMetadata(BaseRecordsController, endpoint), []);
  assert.deepEqual(operationalPermissions(BaseRecordsController, endpoint), [
    "baseRecords.view",
  ]);
}

for (const endpoint of institutionalAdminWriteEndpoints) {
  assert.deepEqual(rolesMetadata(BaseRecordsController, endpoint), [
    ...OPERATIONAL_ADMIN_ROLES,
  ]);
  assert.deepEqual(operationalPermissions(BaseRecordsController, endpoint), []);
}

for (const endpoint of globalAdminWriteEndpoints) {
  assert.deepEqual(rolesMetadata(BaseRecordsController, endpoint), [
    ...GLOBAL_OPERATIONAL_ADMIN_ROLES,
  ]);
  assert.deepEqual(operationalPermissions(BaseRecordsController, endpoint), []);
}

assert.deepEqual(rolesMetadata(BusAssignmentsController), [
  ...OPERATIONAL_ADMIN_ROLES,
]);
assert.deepEqual(
  rolesMetadata(BaseRecordsController, "createInstitution").includes(RoleCode.USER),
  false,
);
assert.deepEqual(
  operationalPermissions(BaseRecordsController, "createBus").includes(
    "baseRecords.manage",
  ),
  false,
);

const rolesGuard = new RolesGuard(new Reflector());
const baseViewGuard = guardWithPermissions(["baseRecords.view"]);
const financeInvoicesViewGuard = guardWithPermissions(["finance.invoices.view"]);
const collectionsViewGuard = guardWithPermissions(["collections.view"]);
const studentsViewGuard = guardWithPermissions(["students.view"]);
const reportsViewGuard = guardWithPermissions(["reports.view"]);

for (const endpoint of auxiliaryReadEndpoints) {
  assert.equal(
    await studentsViewGuard.canActivate(
      executionContext(BaseRecordsController, endpoint, user([RoleCode.USER])),
    ),
    true,
    `${endpoint} must preserve students.view auxiliary access`,
  );
  assert.equal(
    await reportsViewGuard.canActivate(
      executionContext(BaseRecordsController, endpoint, user([RoleCode.USER])),
    ),
    true,
    `${endpoint} must preserve reports.view auxiliary access`,
  );
  assert.equal(
    await baseViewGuard.canActivate(
      executionContext(BaseRecordsController, endpoint, user([RoleCode.USER])),
    ),
    true,
    `${endpoint} must allow baseRecords.view module access`,
  );
}

assert.equal(
  await financeInvoicesViewGuard.canActivate(
    executionContext(BaseRecordsController, "listInstitutions", user([RoleCode.USER])),
  ),
  true,
  "listInstitutions must allow finance.invoices.view as a finance filter reference",
);
assert.equal(
  await collectionsViewGuard.canActivate(
    executionContext(BaseRecordsController, "listInstitutions", user([RoleCode.USER])),
  ),
  true,
  "listInstitutions must allow collections.view as a collections filter reference",
);
for (const endpoint of ["listShifts", "listBuses"] as const) {
  await assert.rejects(
    () =>
      financeInvoicesViewGuard.canActivate(
        executionContext(BaseRecordsController, endpoint, user([RoleCode.USER])),
      ),
    (error) => error instanceof ForbiddenException,
    `${endpoint} must not be unlocked by finance.invoices.view`,
  );
}

for (const endpoint of baseRecordsViewEndpoints) {
  assert.equal(
    await baseViewGuard.canActivate(
      executionContext(BaseRecordsController, endpoint, user([RoleCode.USER])),
    ),
    true,
    `${endpoint} must allow USER with baseRecords.view`,
  );
  await assert.rejects(
    () =>
      studentsViewGuard.canActivate(
        executionContext(BaseRecordsController, endpoint, user([RoleCode.USER])),
      ),
    (error) => error instanceof ForbiddenException,
    `${endpoint} must deny USER without baseRecords.view`,
  );
}

for (const endpoint of adminWriteEndpoints) {
  assert.equal(
    rolesGuard.canActivate(
      executionContext(BaseRecordsController, endpoint, user([RoleCode.ADMINISTRATOR])),
    ),
    true,
    `${endpoint} must preserve ADMINISTRATOR write access`,
  );
  assert.equal(
    rolesGuard.canActivate(
      executionContext(BaseRecordsController, endpoint, user([RoleCode.SUPER_ADMIN])),
    ),
    true,
    `${endpoint} must preserve SUPER_ADMIN write access`,
  );
  await assert.rejects(
    async () =>
      rolesGuard.canActivate(
        executionContext(BaseRecordsController, endpoint, user([RoleCode.USER])),
      ),
    (error) => error instanceof ForbiddenException,
    `${endpoint} must deny direct USER write access`,
  );
  await assert.rejects(
    async () =>
      rolesGuard.canActivate(
        executionContext(BaseRecordsController, endpoint, user([RoleCode.GESTOR])),
      ),
    (error) => error instanceof ForbiddenException,
    `${endpoint} must deny GESTOR write access`,
  );
}

for (const endpoint of globalAdminWriteEndpoints) {
  await assert.rejects(
    async () =>
      rolesGuard.canActivate(
        executionContext(BaseRecordsController, endpoint, user([RoleCode.SECRETARIA])),
      ),
    (error) => error instanceof ForbiddenException,
    `${endpoint} must deny SECRETARIA global write access`,
  );
}

for (const endpoint of institutionalAdminWriteEndpoints) {
  assert.equal(
    rolesGuard.canActivate(
      executionContext(BaseRecordsController, endpoint, user([RoleCode.SECRETARIA])),
    ),
    true,
    `${endpoint} must preserve SECRETARIA institution write access for a later sprint`,
  );
}

await assert.rejects(
  async () =>
    rolesGuard.canActivate(
      executionContext(BusAssignmentsController, "listBusAssignments", user([RoleCode.USER])),
    ),
  (error) => error instanceof ForbiddenException,
  "Bus assignment details must remain outside USER baseRecords.view in F.2E.1",
);

assert.equal(
  rolesGuard.canActivate(
    executionContext(
      BusAssignmentsController,
      "assignBus",
      user([RoleCode.SECRETARIA]),
    ),
  ),
  true,
  "BusAssignments must preserve SECRETARIA assign/release/switch access",
);

console.log("Base records operational view permissions OK");

function operationalPermissions(
  controller: new (...args: never[]) => unknown,
  methodName: string,
) {
  const handler = method(controller, methodName);
  return Reflect.getMetadata(OPERATIONAL_PERMISSIONS_KEY, handler) ?? [];
}

function rolesMetadata(
  controller: new (...args: never[]) => unknown,
  methodName?: string,
) {
  const target = methodName ? method(controller, methodName) : controller;
  return Reflect.getMetadata(ROLES_METADATA_KEY, target) ?? [];
}

function method(
  controller: new (...args: never[]) => unknown,
  methodName: string,
) {
  return Object.getOwnPropertyDescriptor(controller.prototype, methodName)
    ?.value as () => unknown;
}

function guardWithPermissions(permissions: SprintOperationalPermissionKey[]) {
  return new OperationalPermissionGuard(new Reflector(), {
    permissionProfile: {
      findFirst: async () => ({
        permissions: permissions.map((permissionKey) => ({ permissionKey })),
      }),
    },
  } as never);
}

function executionContext(
  controller: new (...args: never[]) => unknown,
  methodName: string,
  currentUser: AuthUser,
) {
  return {
    getClass: () => controller,
    getHandler: () => method(controller, methodName),
    switchToHttp: () => ({
      getRequest: () => ({ user: currentUser }),
    }),
  } as never;
}

function user(roles: RoleCode[]): AuthUser {
  return {
    email: "user@example.com",
    id: "user-1",
    institutionId: null,
    institutionIds: ["institution-a"],
    name: "User",
    permissionProfileId: "profile-1",
    roles,
    status: UserStatus.ACTIVE,
  };
}
