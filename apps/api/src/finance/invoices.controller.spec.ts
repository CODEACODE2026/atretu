import "reflect-metadata";
import assert from "node:assert/strict";
import { AuthGuard } from "../auth/auth.guard.js";
import {
  OPERATIONAL_PERMISSIONS_KEY,
} from "../auth/operational-permissions.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { InvoicesController } from "./invoices.controller.js";

const GUARDS_METADATA_KEY = "__guards__";

assert.deepEqual(
  Reflect.getMetadata(GUARDS_METADATA_KEY, InvoicesController),
  [AuthGuard, OperationalPermissionGuard],
);

for (const method of [
  "listInvoices",
  "getInvoice",
  "listStudentInvoices",
] as const) {
  assert.deepEqual(
    Reflect.getMetadata(
      OPERATIONAL_PERMISSIONS_KEY,
      InvoicesController.prototype[method],
    ),
    ["finance.invoices.view"],
    `${method} must be USER-readable through finance.invoices.view`,
  );
  assert.equal(
    Reflect.getMetadata("roles", InvoicesController.prototype[method]),
    undefined,
    `${method} must not keep RolesGuard-only authorization`,
  );
}

for (const method of [
  "previewInvoice",
  "createInvoice",
  "cancelInvoice",
] as const) {
  assert.deepEqual(
    Reflect.getMetadata(
      OPERATIONAL_PERMISSIONS_KEY,
      InvoicesController.prototype[method],
    ),
    ["finance.invoices.manage"],
    `${method} must be USER-manageable through finance.invoices.manage`,
  );
  assert.equal(
    Reflect.getMetadata("roles", InvoicesController.prototype[method]),
    undefined,
    `${method} must not keep RolesGuard-only authorization`,
  );
}

console.log("Invoices controller permissions OK");
