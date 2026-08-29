import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RoleCode, UserStatus } from "@prisma/client";
import {
  FinancialReportsService,
  resolveReportMonth,
} from "./financial-reports.service.js";

const service = readFileSync(new URL("./financial-reports.service.ts", import.meta.url), "utf8");
const controller = readFileSync(new URL("./financial-reports.controller.ts", import.meta.url), "utf8");

assert.match(controller, /@Controller\("finance\/reports"\)/);
assert.match(controller, /@Get\("monthly"\)/);
assert.match(controller, /@Roles\(\.\.\.OPERATIONAL_ADMIN_ROLES\)/);
assert.match(controller, /@CurrentUser\(\) user: AuthUser/);
assert.match(controller, /this\.reports\.monthly\(query, user\)/);
assert.doesNotMatch(controller, /RoleCode\.GESTOR/);

assert.match(service, /JOIN bank_slips bs ON bs\.invoice_id = i\.id/);
assert.match(service, /JOIN enrollments e ON e\.id = i\.enrollment_id/);
assert.match(service, /getInstitutionScope\(user, OPERATIONAL_INSTITUTION_SCOPE\)/);
assert.match(service, /manual_financial_movements m/);
assert.doesNotMatch(service, /\$\{Prisma\.raw\(_?alias\)\}\.institution_id/);
assert.doesNotMatch(service, /ManualFinancialMovementWhereInput[\s\S]*institutionId:\s*\{/);
assert.match(service, /bs\.paid_at >=/);
assert.match(service, /ManualFinancialMovementStatus\.RECEIVED/);
assert.match(service, /transactionDate: \{ gte: period\.start, lt: next \}/);
assert.match(service, /ManualFinancialMovementStatus\.PAID/);
assert.match(service, /paidAt: \{ gte: period\.start, lt: next \}/);
assert.match(service, /GROUP BY 1/);

const explicit = resolveReportMonth({ month: 1, year: 2027 }, new Date("2026-08-15T12:00:00.000Z"));
assert.equal(explicit.date, "2027-01-01");
assert.equal(explicit.startUtc.toISOString(), "2027-01-01T03:00:00.000Z");
assert.equal(explicit.endUtc.toISOString(), "2027-02-01T03:00:00.000Z");

const saoPauloDefault = resolveReportMonth({}, new Date("2026-01-01T01:30:00.000Z"));
assert.equal(saoPauloDefault.month, 12);
assert.equal(saoPauloDefault.year, 2025);

const secretaryA = testUser(RoleCode.SECRETARIA, ["institution-a"]);
const secretaryAB = testUser(RoleCode.SECRETARIA, [
  "institution-a",
  "institution-b",
]);
const secretaryWithoutInstitution = testUser(RoleCode.SECRETARIA, []);
const administrator = testUser(RoleCode.ADMINISTRATOR, []);
const superAdmin = testUser(RoleCode.SUPER_ADMIN, []);
const user = testUser(RoleCode.USER, ["institution-a"]);

const secretaryAReport = createReportHarness();
await secretaryAReport.service.monthly({ month: 8, year: 2026 }, secretaryA);
assertScopedInvoiceQueries(secretaryAReport.rawQueries, ["institution-a"]);
assertManualMovementsExcludedFromInstitutionReport(secretaryAReport.aggregateWheres);
assertManualMovementsExcludedFromInstitutionReport(secretaryAReport.groupByWheres);
assertManualSqlExcludedFromInstitutionReport(secretarySafeQueries(secretaryAReport.rawQueries));

const secretaryABReport = createReportHarness();
await secretaryABReport.service.monthly({ month: 8, year: 2026 }, secretaryAB);
assertScopedInvoiceQueries(secretaryABReport.rawQueries, [
  "institution-a",
  "institution-b",
]);
assertManualMovementsExcludedFromInstitutionReport(secretaryABReport.aggregateWheres);

const secretaryEmptyReport = createReportHarness();
await secretaryEmptyReport.service.monthly(
  { month: 8, year: 2026 },
  secretaryWithoutInstitution,
);
assertDeniedInvoiceQueries(secretaryEmptyReport.rawQueries);
assertManualMovementsExcludedFromInstitutionReport(secretaryEmptyReport.aggregateWheres);

const administratorReport = createReportHarness();
await administratorReport.service.monthly({ month: 8, year: 2026 }, administrator);
assertGlobalInvoiceQueries(administratorReport.rawQueries);
assertGlobalManualMovementWheres(administratorReport.aggregateWheres);
assertManualSqlIncludedInGlobalReport(secretarySafeQueries(administratorReport.rawQueries));

const superAdminReport = createReportHarness();
await superAdminReport.service.monthly({ month: 8, year: 2026 }, superAdmin);
assertGlobalInvoiceQueries(superAdminReport.rawQueries);
assertGlobalManualMovementWheres(superAdminReport.aggregateWheres);

assert.deepEqual(
  user.roles.filter((role) => operationalMonthlyReportRoles().has(role)),
  [],
  "USER must remain outside OPERATIONAL_ADMIN_ROLES monthly report access",
);

console.log("Financial monthly reports global manual movements guard OK");

function createReportHarness() {
  const rawQueries: unknown[] = [];
  const aggregateWheres: unknown[] = [];
  const groupByWheres: unknown[] = [];
  const service = new FinancialReportsService({
    $queryRaw: async (query: unknown) => {
      rawQueries.push(query);
      return rawQueries.length === 1 ? [{ totalCents: 0 }] : [];
    },
    manualFinancialMovement: {
      aggregate: async ({ where }: { where: unknown }) => {
        aggregateWheres.push(where);
        return { _sum: { amountCents: 0 } };
      },
      groupBy: async ({ where }: { where: unknown }) => {
        groupByWheres.push(where);
        return [];
      },
    },
  } as never);

  return { aggregateWheres, groupByWheres, rawQueries, service };
}

function operationalMonthlyReportRoles() {
  return new Set<RoleCode>([
    RoleCode.SUPER_ADMIN,
    RoleCode.ADMINISTRATOR,
    RoleCode.SECRETARIA,
  ]);
}

function testUser(role: RoleCode, institutionIds: string[]) {
  return {
    email: `${role.toLowerCase()}@example.com`,
    id: `${role.toLowerCase()}-id`,
    institutionId: institutionIds[0],
    institutionIds,
    name: role,
    permissionProfileId: role === RoleCode.USER ? "profile-1" : undefined,
    roles: [role],
    status: UserStatus.ACTIVE,
  };
}

function assertScopedInvoiceQueries(queries: unknown[], institutionIds: string[]) {
  assert.equal(queries.length, 2);
  for (const query of queries) {
    const text = sqlText(query);
    assert.match(text, /JOIN enrollments e ON e\.id = i\.enrollment_id/);
    assert.match(text, /e\.institution_id IN/);
    for (const institutionId of institutionIds) {
      assert.ok(sqlValues(query).includes(institutionId), `${institutionId} missing`);
    }
  }
}

function assertDeniedInvoiceQueries(queries: unknown[]) {
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.match(sqlText(query), /JOIN enrollments e ON e\.id = i\.enrollment_id/);
    assert.match(sqlText(query), /FALSE/);
  }
}

function assertGlobalInvoiceQueries(queries: unknown[]) {
  assert.equal(queries.length, 2);
  for (const query of queries) {
    const text = sqlText(query);
    assert.doesNotMatch(text, /JOIN enrollments e ON e\.id = i\.enrollment_id/);
    assert.doesNotMatch(text, /e\.institution_id IN/);
  }
}

function assertManualMovementsExcludedFromInstitutionReport(wheres: unknown[]) {
  assert.ok(wheres.length > 0);
  for (const where of wheres) {
    const serialized = JSON.stringify(where);
    assert.doesNotMatch(serialized, /"institutionId"/);
    assert.match(serialized, /"id":\{"in":\[\]\}/);
  }
}

function assertGlobalManualMovementWheres(wheres: unknown[]) {
  assert.ok(wheres.length > 0);
  for (const where of wheres) {
    const serialized = JSON.stringify(where);
    assert.doesNotMatch(serialized, /"institutionId"/);
    assert.doesNotMatch(serialized, /"id":\{"in":\[\]\}/);
  }
}

function assertManualSqlExcludedFromInstitutionReport(queries: unknown[]) {
  assert.ok(queries.length > 0);
  for (const query of queries) {
    const text = sqlText(query);
    assert.match(text, /manual_financial_movements m/);
    assert.match(text, /AND FALSE/);
    assert.doesNotMatch(text, /m\.institution_id/);
  }
}

function assertManualSqlIncludedInGlobalReport(queries: unknown[]) {
  assert.ok(queries.length > 0);
  for (const query of queries) {
    const text = sqlText(query);
    assert.match(text, /manual_financial_movements m/);
    assert.doesNotMatch(text, /AND FALSE/);
    assert.doesNotMatch(text, /m\.institution_id/);
  }
}

function secretarySafeQueries(queries: unknown[]) {
  return queries.slice(1);
}

function sqlText(query: unknown) {
  const input = query as {
    sql?: string;
    statement?: string;
    strings?: readonly string[];
    text?: string;
  };
  return [
    input.sql,
    input.text,
    input.statement,
    ...(input.strings ?? []),
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function sqlValues(query: unknown) {
  return ((query as { values?: unknown[] }).values ?? []) as unknown[];
}
