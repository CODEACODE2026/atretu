import "reflect-metadata";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { BankSlipIssueBatchSource, RoleCode, UserStatus } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import {
  OPERATIONAL_PERMISSIONS_KEY,
} from "../auth/operational-permissions.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OPERATIONAL_ADMIN_ROLES } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { BankSlipsController } from "./bank-slips.controller.js";

const GUARDS_METADATA_KEY = "__guards__";

assert.deepEqual(
  Reflect.getMetadata(GUARDS_METADATA_KEY, BankSlipsController),
  [AuthGuard, OperationalPermissionGuard],
);

assert.deepEqual(
  Reflect.getMetadata(
    OPERATIONAL_PERMISSIONS_KEY,
    BankSlipsController.prototype.getByInvoice,
  ),
  ["finance.invoices.view"],
  "getByInvoice must expose only saved bank slip metadata to finance.invoices.view",
);
assert.equal(
  Reflect.getMetadata("roles", BankSlipsController.prototype.getByInvoice),
  undefined,
);

for (const method of [
  "issueForInvoice",
  "syncByInvoice",
  "createIssueBatch",
  "previewIssueBatch",
  "getIssueBatch",
  "listIssueBatchItems",
  "requestCancellation",
  "getPdf",
] as const) {
  assert.deepEqual(
    Reflect.getMetadata(
      OPERATIONAL_PERMISSIONS_KEY,
      BankSlipsController.prototype[method],
    ),
    ["finance.bankSlips.manage"],
    `${method} must require finance.bankSlips.manage`,
  );
  assert.equal(
    Reflect.getMetadata("roles", BankSlipsController.prototype[method]),
    undefined,
    `${method} must not keep fixed operational role metadata`,
  );
}

for (const method of [
  "listIssueBatches",
  "downloadIssueBatchPdfs",
  "cancelIssueBatch",
] as const) {
  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA_KEY, BankSlipsController.prototype[method]),
    [RolesGuard],
    `${method} must keep operational role guard`,
  );
  assert.deepEqual(
    Reflect.getMetadata("roles", BankSlipsController.prototype[method]),
    [...OPERATIONAL_ADMIN_ROLES],
    `${method} must stay restricted to operational admin roles`,
  );
}

for (const method of [
  "recoverIssuedFromProviderResponse",
  "syncPaidByDay",
  "syncOpenIssued",
  "recoverBankSlipPdfs",
  "listSyncRuns",
  "getSyncRun",
  "listSyncRunItems",
  "retryFailedIssueBatch",
] as const) {
  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA_KEY, BankSlipsController.prototype[method]),
    [RolesGuard],
    `${method} must keep technical role guard`,
  );
  assert.deepEqual(
    Reflect.getMetadata("roles", BankSlipsController.prototype[method]),
    [RoleCode.SUPER_ADMIN],
    `${method} must stay SUPER_ADMIN-only`,
  );
}

const controllerServiceCalls: unknown[] = [];
const controller = new BankSlipsController({
  createIssueBatch: (...args: unknown[]) => {
    controllerServiceCalls.push(args);
    return { id: "issue-batch-1" };
  },
} as never);
const scopedUser = {
  email: "user@example.com",
  id: "user-1",
  institutionId: "institution-1",
  institutionIds: ["institution-1"],
  name: "User",
  permissionProfileId: "profile-1",
  roles: [RoleCode.USER],
  status: UserStatus.ACTIVE,
};

assert.deepEqual(
  controller.createIssueBatch(
    {
      invoiceIds: ["00000000-0000-4000-8000-000000000001"],
      source: BankSlipIssueBatchSource.MANUAL,
    },
    scopedUser,
  ),
  { id: "issue-batch-1" },
  "USER with finance.bankSlips.manage may create manual invoice-selected batches",
);
assert.equal(controllerServiceCalls.length, 1);
assert.deepEqual(
  controller.createIssueBatch(
    {
      amountCents: 12050,
      createMissingInvoices: true,
      dueDate: "2099-08-10",
      institutionId: "00000000-0000-4000-8000-000000000002",
      source: BankSlipIssueBatchSource.INSTITUTION,
    },
    scopedUser,
  ),
  { id: "issue-batch-1" },
  "USER with finance.bankSlips.manage may create institution batches after service scope validation",
);
assert.equal(controllerServiceCalls.length, 2);
assert.throws(
  () =>
    controller.createIssueBatch(
      {
        amountCents: 12050,
        createMissingInvoices: true,
        dueDate: "2099-08-10",
        source: BankSlipIssueBatchSource.INSTITUTION,
      },
      scopedUser,
    ),
  (error) => error instanceof ForbiddenException,
  "USER must not create institution batches without an institutionId",
);

console.log("Bank slips controller permissions OK");
