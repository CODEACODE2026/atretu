import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  canAccessGlobalOperationalAdmin,
  canManageGlobalOfficialDocumentModels,
  canAccessMigratedArea,
  canAccessOperationalAdmin,
  canAccessRestrictedAdmin,
  getPrimaryRoleLabel,
} from "../src/lib/auth";
import type { ApiUser } from "../src/lib/api";

const baseUser = {
  email: "user@example.com",
  id: "user-1",
  institutionIds: [],
  mustChangePassword: false,
  name: "User",
  status: "ACTIVE",
} satisfies Omit<ApiUser, "capabilities" | "roles">;

const administrator: ApiUser = {
  ...baseUser,
  capabilities: [
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
    "collections.view",
    "officialDocuments.view",
    "officialDocuments.issue",
    "baseRecords.view",
    "reports.view",
    "reports.export",
  ],
  roles: ["ADMINISTRATOR"],
};

assert.equal(canAccessOperationalAdmin(administrator), true);
assert.equal(canAccessGlobalOperationalAdmin(administrator), true);
assert.equal(canManageGlobalOfficialDocumentModels(administrator), true);
assert.equal(canAccessRestrictedAdmin(administrator), false);
assert.equal(getPrimaryRoleLabel(administrator), "Administrador");
for (const area of [
  "dashboard",
  "students",
  "reenrollments",
  "pre-registrations",
  "student-cards",
  "finance",
  "official-documents",
  "base",
  "reports",
] as const) {
  assert.equal(canAccessMigratedArea(administrator, area), true);
}

const userOnlyStudentsView: ApiUser = {
  ...baseUser,
  capabilities: ["students.view"],
  roles: ["USER"],
};

assert.equal(canAccessOperationalAdmin(userOnlyStudentsView), false);
assert.equal(canAccessRestrictedAdmin(userOnlyStudentsView), false);
assert.equal(canAccessMigratedArea(userOnlyStudentsView, "students"), true);
assert.equal(canAccessMigratedArea(userOnlyStudentsView, "dashboard"), false);
assert.equal(canAccessMigratedArea(userOnlyStudentsView, "reenrollments"), false);
assert.equal(canAccessMigratedArea(userOnlyStudentsView, "pre-registrations"), false);
assert.equal(canAccessMigratedArea(userOnlyStudentsView, "student-cards"), false);

const userOnlyStudentCardsView: ApiUser = {
  ...baseUser,
  capabilities: ["studentCards.view"],
  roles: ["USER"],
};

assert.equal(canAccessMigratedArea(userOnlyStudentCardsView, "student-cards"), true);
assert.equal(canAccessMigratedArea(userOnlyStudentCardsView, "students"), false);

const userOnlyFinanceInvoicesView: ApiUser = {
  ...baseUser,
  capabilities: ["finance.invoices.view"],
  roles: ["USER"],
};

assert.equal(canAccessMigratedArea(userOnlyFinanceInvoicesView, "finance"), true);
assert.equal(canAccessMigratedArea(userOnlyFinanceInvoicesView, "students"), false);
assert.equal(canAccessMigratedArea(userOnlyFinanceInvoicesView, "reports"), false);

const userOnlyCollectionsView: ApiUser = {
  ...baseUser,
  capabilities: ["collections.view"],
  roles: ["USER"],
};

assert.equal(canAccessMigratedArea(userOnlyCollectionsView, "finance"), true);
assert.equal(canAccessMigratedArea(userOnlyCollectionsView, "students"), false);
assert.equal(canAccessMigratedArea(userOnlyCollectionsView, "reports"), false);

const userOnlyManualMovementsManage: ApiUser = {
  ...baseUser,
  capabilities: ["manualMovements.manage"],
  roles: ["USER"],
};

assert.equal(canAccessMigratedArea(userOnlyManualMovementsManage, "finance"), true);
assert.equal(canAccessMigratedArea(userOnlyManualMovementsManage, "students"), false);
assert.equal(canAccessMigratedArea(userOnlyManualMovementsManage, "reports"), false);

const userOnlyBaseRecordsView: ApiUser = {
  ...baseUser,
  capabilities: ["baseRecords.view"],
  roles: ["USER"],
};

assert.equal(canAccessOperationalAdmin(userOnlyBaseRecordsView), false);
assert.equal(canAccessMigratedArea(userOnlyBaseRecordsView, "base"), true);
assert.equal(canAccessMigratedArea(userOnlyBaseRecordsView, "students"), false);
assert.equal(canAccessMigratedArea(userOnlyBaseRecordsView, "reports"), false);

for (const role of ["SECRETARIA", "SUPER_ADMIN"] as const) {
  assert.equal(
    canAccessOperationalAdmin({ ...baseUser, capabilities: [], roles: [role] }),
    true,
  );
}
assert.equal(
  canManageGlobalOfficialDocumentModels({
    ...baseUser,
    capabilities: [],
    roles: ["SUPER_ADMIN"],
  }),
  true,
);
assert.equal(
  canAccessGlobalOperationalAdmin({
    ...baseUser,
    capabilities: [],
    roles: ["SUPER_ADMIN"],
  }),
  true,
);
assert.equal(
  canManageGlobalOfficialDocumentModels({
    ...baseUser,
    capabilities: [],
    roles: ["SECRETARIA"],
  }),
  false,
);
assert.equal(
  canAccessGlobalOperationalAdmin({
    ...baseUser,
    capabilities: [],
    roles: ["SECRETARIA"],
  }),
  false,
);
assert.equal(
  canManageGlobalOfficialDocumentModels({
    ...baseUser,
    capabilities: [],
    roles: ["USER"],
  }),
  false,
);
assert.equal(
  canAccessGlobalOperationalAdmin({
    ...baseUser,
    capabilities: [],
    roles: ["USER"],
  }),
  false,
);

assert.equal(
  canAccessOperationalAdmin({ ...baseUser, capabilities: [], roles: ["GESTOR"] }),
  false,
);
assert.equal(
  canAccessGlobalOperationalAdmin({ ...baseUser, capabilities: [], roles: ["GESTOR"] }),
  false,
);

const adminShellSource = readFileSync(
  new URL("../src/app/admin/admin-shell.tsx", import.meta.url),
  "utf8",
);
assert.match(adminShellSource, /nextArea === "student-cards"/);
assert.match(adminShellSource, /nextArea === "finance"/);
assert.match(adminShellSource, /nextArea === "base"/);
assert.match(adminShellSource, /canManageBaseRecords/);
assert.match(adminShellSource, /canManageGlobalBaseRecords/);
assert.match(adminShellSource, /canManageCurrentDomain/);
assert.match(
  adminShellSource,
  /domain === "institutions"\s+\?\s+canManageBaseRecords\s+:\s+canManageGlobalBaseRecords/,
);
assert.match(adminShellSource, /canViewBusAssignments/);
assert.match(
  adminShellSource,
  /currentDomain\.hasCapacity\s+&&\s+canViewBusAssignments/,
);
assert.match(adminShellSource, /accessibleDomains/);
assert.doesNotMatch(
  adminShellSource,
  /Seu perfil possui acesso operacional\. Areas restritas do Super\s+Admin permanecem bloqueadas\./,
);

const financePanelSource = readFileSync(
  new URL("../src/app/admin/finance-panel.tsx", import.meta.url),
  "utf8",
);
assert.match(financePanelSource, /const canManageFinance = canAccessOperationalAdmin\(user\);/);
assert.match(financePanelSource, /hasCapability\(user, "collections\.view"\)/);
assert.match(financePanelSource, /const canViewInvoices = canManageFinance \|\| hasCapability\(user, "finance\.invoices\.view"\);/);
assert.match(financePanelSource, /const canRetryIssueBatches = canAccessRestrictedAdmin\(user\);/);
assert.match(financePanelSource, /return canAccessRestrictedAdmin\(user\);/);

console.log("Administrator web access policy OK");
