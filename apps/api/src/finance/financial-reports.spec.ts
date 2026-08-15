import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveReportMonth } from "./financial-reports.service.js";

const service = readFileSync(new URL("./financial-reports.service.ts", import.meta.url), "utf8");
const controller = readFileSync(new URL("./financial-reports.controller.ts", import.meta.url), "utf8");

assert.match(controller, /@Controller\("finance\/reports"\)/);
assert.match(controller, /@Get\("monthly"\)/);
assert.match(controller, /@Roles\(RoleCode\.SUPER_ADMIN, RoleCode\.SECRETARIA\)/);
assert.doesNotMatch(controller, /RoleCode\.GESTOR/);

assert.match(service, /JOIN bank_slips bs ON bs\.invoice_id = i\.id/);
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
