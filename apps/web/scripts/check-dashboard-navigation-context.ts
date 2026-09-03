import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
