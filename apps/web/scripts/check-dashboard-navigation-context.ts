import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ApiUser } from "../src/lib/api";
import {
  canAccessMigratedArea,
  canAccessOperationalAdmin,
  canAccessRestrictedAdmin,
  canAccessUserAdministration,
} from "../src/lib/auth";
import {
  ADMIN_NAV_ITEMS,
  mergeAccountUserNavigationContext,
  type AdminArea,
} from "../src/app/admin/admin-navigation";
import {
  adminAreaHref,
  dashboardTargetHref,
  parseDashboardHref,
  studentsListHref,
} from "../src/app/admin/admin-dashboard-navigation";

const shell = readFileSync("src/app/admin/admin-shell.tsx", "utf8");

const academicYearId = "11111111-1111-4111-8111-111111111111";
const institutionId = "22222222-2222-4222-8222-222222222222";
const shiftId = "33333333-3333-4333-8333-333333333333";

const suspendedTarget = parseDashboardHref(
  `/admin?area=students&academicYearId=${academicYearId}&studentStatus=SUSPENDED`,
);
assert.equal(suspendedTarget?.area, "students");
assert.equal(suspendedTarget?.academicYearId, academicYearId);
assert.equal(suspendedTarget?.studentStatus, "suspended");

const lowercaseTarget = parseDashboardHref(
  `/admin?area=students&academicYearId=${academicYearId}&studentStatus=terminated`,
);
assert.equal(lowercaseTarget?.studentStatus, "terminated");

assert.equal(
  parseDashboardHref("/admin?area=students&studentStatus=INVALID")?.studentStatus,
  undefined,
);
assert.equal(parseDashboardHref("/admin?area=account")?.area, "account");
assert.equal(adminAreaHref("account"), "/admin?area=account");
assert.ok(
  shell.includes("const navigationItems = visibleTabs"),
  "account must not replace the policy-derived navigation menu",
);
assert.ok(
  shell.includes("items={navigationItems}"),
  "sidebar and mobile navigation must receive the preserved menu",
);
assert.ok(
  shell.includes('const navigationActiveArea = effectiveArea === "account" ? null : effectiveArea;'),
  "account must keep administrative active area neutral",
);
assert.ok(
  shell.includes("mergeAccountUserNavigationContext(user, accountUser)"),
  "account response must be merged without dropping navigation context",
);

const fullCapabilities = [
  "dashboard.view",
  "students.view",
  "students.reenroll",
  "preRegistrations.view",
  "studentCards.view",
  "finance.invoices.view",
  "officialDocuments.view",
  "reports.view",
  "baseRecords.view",
];
const operationalCapabilities = [
  "dashboard.view",
  "students.view",
  "finance.invoices.view",
  "reports.view",
];

for (const scenario of [
  {
    area: "dashboard",
    capabilities: fullCapabilities,
    roles: ["SUPER_ADMIN"],
  },
  {
    area: "finance",
    capabilities: fullCapabilities,
    roles: ["SUPER_ADMIN"],
  },
  {
    area: "users",
    capabilities: fullCapabilities,
    roles: ["SUPER_ADMIN"],
  },
  {
    area: "dashboard",
    capabilities: operationalCapabilities,
    roles: ["ADMINISTRATOR"],
  },
  {
    area: "students",
    capabilities: operationalCapabilities,
    roles: ["USER"],
  },
  {
    area: "finance",
    capabilities: operationalCapabilities,
    roles: ["SECRETARIA"],
  },
] as const) {
  const currentUser = makeUser(scenario.roles, scenario.capabilities);
  const accountUser = { ...currentUser };
  delete accountUser.capabilities;
  const beforeAccount = visibleNavigationKeys(currentUser);
  const duringAccount = visibleNavigationKeys(
    mergeAccountUserNavigationContext(currentUser, accountUser),
  );
  assert.deepEqual(
    duringAccount,
    beforeAccount,
    `${scenario.roles.join("/")} ${scenario.area} -> account must preserve the same menu`,
  );
  assert.equal(
    duringAccount.every((key) => navigationGroup(key) === "administration"),
    false,
    `${scenario.roles.join("/")} account menu must not collapse to administration`,
  );
}

assert.equal(
  dashboardTargetHref({
    area: "students",
    academicYearId,
    studentStatus: "active",
  }),
  `/admin?area=students&academicYearId=${academicYearId}&studentStatus=ACTIVE`,
);

assert.equal(
  studentsListHref({
    academicYearId,
    boardMembership: "inactive",
    institutionId,
    shiftId,
    status: "suspended",
  }),
  `/admin?area=students&academicYearId=${academicYearId}&institutionId=${institutionId}&shiftId=${shiftId}&studentStatus=SUSPENDED&boardMembership=inactive`,
);

assert.equal(
  studentsListHref({
    academicYearId: "",
    boardMembership: "all",
    institutionId: "",
    shiftId: "",
    status: "active",
  }),
  "/admin?area=students",
);

console.log("Dashboard navigation context guard OK");

function makeUser(
  roles: readonly ApiUser["roles"][number][],
  capabilities: readonly string[],
): ApiUser {
  return {
    capabilities: [...capabilities],
    email: "qa@example.com",
    id: "qa-user",
    name: "QA User",
    roles: [...roles],
    status: "ACTIVE",
  };
}

function visibleNavigationKeys(user: ApiUser): AdminArea[] {
  return ADMIN_NAV_ITEMS.filter((item) => canAccessArea(user, item.key)).map(
    (item) => item.key,
  );
}

function canAccessArea(user: ApiUser, nextArea: AdminArea): boolean {
  if (nextArea === "account") {
    return true;
  }
  if (
    nextArea === "dashboard" ||
    nextArea === "students" ||
    nextArea === "reenrollments" ||
    nextArea === "official-documents" ||
    nextArea === "base" ||
    nextArea === "reports" ||
    nextArea === "student-cards" ||
    nextArea === "pre-registrations" ||
    nextArea === "finance"
  ) {
    return canAccessMigratedArea(user, nextArea);
  }
  if (nextArea === "users" || nextArea === "permission-profiles") {
    return canAccessUserAdministration(user);
  }
  const hasLegacyOperationalAccess = canAccessOperationalAdmin(user);
  if (!hasLegacyOperationalAccess) {
    return false;
  }
  const navItem = ADMIN_NAV_ITEMS.find((item) => item.key === nextArea);
  return !navItem || !("restricted" in navItem) || canAccessRestrictedAdmin(user);
}

function navigationGroup(area: AdminArea): string | undefined {
  return ADMIN_NAV_ITEMS.find((item) => item.key === area)?.group;
}
