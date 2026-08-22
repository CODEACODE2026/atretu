import assert from "node:assert/strict";
import {
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
  ],
  roles: ["ADMINISTRATOR"],
};

assert.equal(canAccessOperationalAdmin(administrator), true);
assert.equal(canAccessRestrictedAdmin(administrator), false);
assert.equal(getPrimaryRoleLabel(administrator), "Administrador");
for (const area of [
  "dashboard",
  "students",
  "reenrollments",
  "pre-registrations",
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

for (const role of ["SECRETARIA", "SUPER_ADMIN"] as const) {
  assert.equal(
    canAccessOperationalAdmin({ ...baseUser, capabilities: [], roles: [role] }),
    true,
  );
}

assert.equal(
  canAccessOperationalAdmin({ ...baseUser, capabilities: [], roles: ["GESTOR"] }),
  false,
);

console.log("Administrator web access policy OK");
