import { readdirSync, readFileSync, statSync } from "node:fs";
import assert from "node:assert/strict";
import {
  ACTIVE_DELEGATABLE_PERMISSION_KEYS,
  DELEGATABLE_PERMISSION_CATALOG,
  isActiveDelegatablePermissionKey,
  isDelegatablePermissionKey,
  isPermissionKey,
  PERMISSION_CATALOG,
  RESERVED_PERMISSION_KEYS,
  type PermissionKey,
} from "./permission-catalog.js";

const schema = readFileSync(
  new URL("../../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260821133000_sprint_15_10b_permission_profiles/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const apiSrcDir = new URL("../", import.meta.url);

const expectedRoleCodes = [
  "SUPER_ADMIN",
  "ADMINISTRATOR",
  "USER",
  "SECRETARIA",
  "GESTOR",
];

for (const role of expectedRoleCodes) {
  assert.match(schema, new RegExp(`\\b${role}\\b`));
}

assert.match(schema, /model PermissionProfile \{/);
assert.match(schema, /name\s+String\s+@unique\s+@db\.VarChar\(120\)/);
assert.match(schema, /isActive\s+Boolean\s+@default\(true\)\s+@map\("is_active"\)/);
assert.match(schema, /model PermissionProfilePermission \{/);
assert.match(schema, /permissionKey\s+String\s+@map\("permission_key"\)\s+@db\.VarChar\(80\)/);
assert.match(schema, /@@id\(\[profileId, permissionKey\]\)/);
assert.match(schema, /permissionProfileId\s+String\?\s+@map\("permission_profile_id"\)\s+@db\.Uuid/);
assert.match(schema, /phone\s+String\?\s+@db\.VarChar\(30\)/);
assert.match(schema, /position\s+String\?\s+@db\.VarChar\(120\)/);

assert.match(migration, /ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'ADMINISTRATOR'/);
assert.match(migration, /ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'USER'/);
assert.match(migration, /CREATE TABLE "permission_profiles"/);
assert.match(migration, /CREATE TABLE "permission_profile_permissions"/);
assert.match(migration, /ADD COLUMN "permission_profile_id" UUID/);
assert.match(migration, /ADD COLUMN "phone" VARCHAR\(30\)/);
assert.match(migration, /ADD COLUMN "position" VARCHAR\(120\)/);
assert.match(migration, /ON CONFLICT \("code"\) DO NOTHING/);
assert.doesNotMatch(migration, /UPDATE\s+"?users"?/i);
assert.doesNotMatch(migration, /UPDATE\s+"?user_roles"?/i);
assert.doesNotMatch(migration, /SECRETARIA'\s*,\s*'USER/i);

const keys = PERMISSION_CATALOG.map((permission) => permission.key);
assert.equal(new Set(keys).size, keys.length);

const approvedKeys: PermissionKey[] = [
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
  "settings.view",
  "settings.manage",
  "users.view",
  "users.manage",
];

assert.deepEqual(keys, approvedKeys);

for (const key of approvedKeys) {
  assert.equal(isPermissionKey(key), true);
}

assert.equal(isPermissionKey("legacyImport.access"), false);
assert.equal(isPermissionKey("jobs.access"), false);
assert.equal(isPermissionKey("sicredi.technical"), false);
assert.equal(isPermissionKey("students.delete"), false);

const delegatableKeys = DELEGATABLE_PERMISSION_CATALOG.map(
  (permission) => permission.key,
);
assert.ok(delegatableKeys.every((key) => isPermissionKey(key)));
assert.equal(isDelegatablePermissionKey("students.view"), true);
assert.equal(isDelegatablePermissionKey("finance.invoices.view"), true);
assert.equal(isDelegatablePermissionKey("settings.view"), false);
assert.equal(isDelegatablePermissionKey("settings.manage"), false);
assert.equal(isDelegatablePermissionKey("users.view"), false);
assert.equal(isDelegatablePermissionKey("users.manage"), false);
assert.equal(isDelegatablePermissionKey("legacyImport.access"), false);
assert.equal(isDelegatablePermissionKey("jobs.access"), false);
assert.equal(isDelegatablePermissionKey("sicredi.technical"), false);
for (const key of RESERVED_PERMISSION_KEYS) {
  assert.equal(delegatableKeys.includes(key), false);
}
for (const permission of DELEGATABLE_PERMISSION_CATALOG) {
  assert.doesNotMatch(permission.key, /^(settings|users)\./);
}
assert.deepEqual(ACTIVE_DELEGATABLE_PERMISSION_KEYS, [
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
]);
assert.equal(isActiveDelegatablePermissionKey("students.view"), true);
assert.equal(isActiveDelegatablePermissionKey("studentCards.view"), true);
assert.equal(isActiveDelegatablePermissionKey("studentCards.issue"), true);
assert.equal(isActiveDelegatablePermissionKey("studentCards.invalidate"), true);
assert.equal(isActiveDelegatablePermissionKey("finance.invoices.view"), false);
assert.equal(isActiveDelegatablePermissionKey("academicYears.manage"), false);
assert.equal(
  DELEGATABLE_PERMISSION_CATALOG.length -
    ACTIVE_DELEGATABLE_PERMISSION_KEYS.length,
  15,
);

const authorizationSourceFiles = listSourceFiles(apiSrcDir).filter(
  (file) =>
    !file.endsWith(".spec.ts") &&
    !file.endsWith("administrator-permissions.ts") &&
    !file.endsWith("operational-permission.guard.ts") &&
    !file.endsWith("operational-permissions.ts") &&
    !file.endsWith("permission-catalog.ts") &&
    !file.endsWith("permission.guard.ts") &&
    !file.endsWith("permissions.decorator.ts") &&
    !file.endsWith("users.service.ts"),
);
const permissionProfileAuthorizationSourceFiles = authorizationSourceFiles.filter(
  (file) =>
    !file.endsWith("app.module.ts") &&
    !file.includes("/permission-profiles/") &&
    !file.includes("/users/"),
);

for (const file of authorizationSourceFiles) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(
    source,
    /@Roles\([^)]*RoleCode\.(?:ADMINISTRATOR|USER)/s,
    `${file} must not delegate endpoints to ADMINISTRATOR or USER in Sprint 15.10B`,
  );
}

for (const file of permissionProfileAuthorizationSourceFiles) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(
    source,
    /PermissionProfile|PermissionKey|PERMISSION_CATALOG/,
    `${file} must not use permission profiles for authorization outside Sprint 15.10C infrastructure`,
  );
}

const controllerSourceFiles = authorizationSourceFiles.filter((file) =>
  file.endsWith(".controller.ts"),
);

for (const file of controllerSourceFiles) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(
    source,
    /@Permissions\(/,
    `${file} must not apply PermissionGuard metadata in Sprint 15.10C`,
  );
  assert.doesNotMatch(
    source,
    /\bPermissionGuard\b/,
    `${file} must not attach PermissionGuard to operational controllers in Sprint 15.10C`,
  );
}

console.log("Permission catalog and profile schema guard OK");

function listSourceFiles(dir: URL): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) {
      return listSourceFiles(entryUrl);
    }
    if (!entry.name.endsWith(".ts")) {
      return [];
    }
    const path = entryUrl.pathname;
    return statSync(path).isFile() ? [path] : [];
  });
}
