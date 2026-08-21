import type { PermissionKey } from "./permission-catalog.js";

export const ADMINISTRATOR_PERMISSION_KEYS = [
  "dashboard.view",
  "students.view",
  "students.create",
  "students.update",
  "students.changeStatus",
  "students.reenroll",
  "students.board.view",
  "students.board.manage",
  "preRegistrations.view",
  "preRegistrations.review",
  "preRegistrations.documents.view",
  "studentCards.view",
  "studentCards.issue",
  "studentCards.invalidate",
  "finance.invoices.view",
  "finance.invoices.manage",
  "finance.bankSlips.manage",
  "collections.view",
  "collections.manage",
  "manualMovements.view",
  "manualMovements.manage",
  "officialDocuments.view",
  "officialDocuments.issue",
  "officialDocuments.models.manage",
  "reports.view",
  "reports.export",
  "baseRecords.view",
  "baseRecords.manage",
  "academicYears.manage",
] as const satisfies readonly PermissionKey[];

const ADMINISTRATOR_PERMISSIONS = new Set<PermissionKey>(
  ADMINISTRATOR_PERMISSION_KEYS,
);

export function hasAdministratorPermission(permission: PermissionKey): boolean {
  return ADMINISTRATOR_PERMISSIONS.has(permission);
}
