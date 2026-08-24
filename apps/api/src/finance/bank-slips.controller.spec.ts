import "reflect-metadata";
import assert from "node:assert/strict";
import { RoleCode } from "@prisma/client";
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
  "listIssueBatches",
  "getIssueBatch",
  "listIssueBatchItems",
  "downloadIssueBatchPdfs",
  "cancelIssueBatch",
  "requestCancellation",
  "getPdf",
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

console.log("Bank slips controller permissions OK");
