import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardPanel = readFileSync(
  resolve("src/app/admin/dashboard-panel.tsx"),
  "utf8",
);
const dashboardService = readFileSync(
  resolve("../api/src/dashboard/dashboard.service.ts"),
  "utf8",
);
const primitives = readFileSync(
  resolve("src/app/admin/components/dashboard-primitives.tsx"),
  "utf8",
);
const adminShell = readFileSync(resolve("src/app/admin/admin-shell.tsx"), "utf8");
const financePanel = readFileSync(
  resolve("src/app/admin/finance-panel.tsx"),
  "utf8",
);
const collectionsPanel = readFileSync(
  resolve("src/app/admin/collections-panel.tsx"),
  "utf8",
);
const studentsPanel = readFileSync(
  resolve("src/app/admin/students-panel.tsx"),
  "utf8",
);
const dashboardNavigation = readFileSync(
  resolve("src/app/admin/admin-dashboard-navigation.ts"),
  "utf8",
);
const preRegistrationsPanel = readFileSync(
  resolve("src/app/admin/pre-registrations-panel.tsx"),
  "utf8",
);
const api = readFileSync(resolve("src/lib/api.ts"), "utf8");

assertIncludes(api, "export type DashboardOperationalBlock");
assertIncludes(api, "operationalBlocks?: DashboardOperationalBlock[]");
assertIncludes(api, "href?: string");

assertIncludes(dashboardPanel, "dashboard.operationalBlocks ?? []");
assertIncludes(dashboardPanel, "DashboardOperationalCard");
assertIncludes(dashboardPanel, "block.key === \"quickActions\"");
assertIncludes(dashboardPanel, "onNavigateHref");
assertIncludes(dashboardPanel, "xl:grid-cols-4");
assertIncludes(dashboardPanel, "block.status === \"error\"");

assertIncludes(primitives, "DashboardOperationalCard");
assertIncludes(primitives, "aria-label={`Abrir ${metric.label}`}");
assertIncludes(primitives, "metric.href");
assertIncludes(primitives, "academics: GraduationCap");
assertIncludes(primitives, "quickActions: Bell");

assertIncludes(adminShell, "parseDashboardHref");
assertIncludes(adminShell, "window.location.href");
assertIncludes(adminShell, "router.push(href)");
assertIncludes(adminShell, "router.replace(adminAreaHref(nextArea))");
assertIncludes(adminShell, "onListFiltersChange={handleStudentsListFiltersChange}");
assertIncludes(adminShell, "studentStatus");
assertIncludes(adminShell, "boardMembership");
assertIncludes(adminShell, "initialBoardMembershipFilter");
assertIncludes(adminShell, "onClearNavigationContext");
assertIncludes(adminShell, "invoiceFilters");
assertIncludes(adminShell, "initialCollectionFilters");
assertIncludes(adminShell, "preRegistrationStatus");
assertIncludes(adminShell, "baseDomain");

assertIncludes(financePanel, "initialInvoiceFilters");
assertIncludes(financePanel, "quickFilterFromInitialFilters");
assertIncludes(financePanel, "initialInvoiceFilters?.academicYearId ?? \"\"");
assertIncludes(financePanel, "initialInvoiceFilters ? \"\" : defaultMonth.from");
assertIncludes(financePanel, "initialInvoiceFilters?.paidAtFrom ?? \"\"");
assertIncludes(financePanel, "setDueDateFrom(\"\")");
assertIncludes(financePanel, "initialCollectionFilters");

assertIncludes(collectionsPanel, "initialFilters?: Partial<CollectionFilters>");
assertIncludes(collectionsPanel, "setFilters({ ...emptyCollectionFilters, ...initialFilters })");

assertIncludes(studentsPanel, "initialStatusFilter");
assertIncludes(studentsPanel, "initialBoardMembershipFilter");
assertIncludes(studentsPanel, "() => initialStatusFilter ?? \"active\"");
assertIncludes(studentsPanel, "() => initialAcademicYearId ?? \"\"");
assertIncludes(studentsPanel, "referencesLoaded");
assertIncludes(studentsPanel, "onListFiltersChange?.({");
assertIncludes(studentsPanel, "initialAction === \"new\"");
assertIncludes(studentsPanel, "includeEmptyOption={false}");
assertIncludes(studentsPanel, "setBoardMembershipFilter(\"all\")");
assertIncludes(studentsPanel, "onClearNavigationContext?.()");

assertIncludes(dashboardNavigation, "parseStudentStatusFilter");
assertIncludes(dashboardNavigation, "serializeStudentStatusFilter");
assertIncludes(dashboardNavigation, "studentsListHref");
assertIncludes(dashboardNavigation, "case \"SUSPENDED\"");
assertIncludes(dashboardNavigation, "serializeStudentStatusFilter(target.studentStatus)");

assertIncludes(preRegistrationsPanel, "initialStatus?: PreRegistrationStatus");
assertIncludes(preRegistrationsPanel, "setStatus(initialStatus)");
assertIncludes(preRegistrationsPanel, "api.listAcademicYears({ status: \"all\" })");
assertIncludes(preRegistrationsPanel, "api.listInstitutions({ status: \"active\", limit: 100, sort: \"name\" })");
assertIncludes(preRegistrationsPanel, "Ano letivo");
assertIncludes(preRegistrationsPanel, "Instituicao");
assertIncludes(preRegistrationsPanel, "Filtros ativos");
assertIncludes(preRegistrationsPanel, "Recebidos do Dashboard");
assertIncludes(preRegistrationsPanel, "Limpar filtros");
assertIncludes(preRegistrationsPanel, "status !== \"all\"");
assertIncludes(preRegistrationsPanel, "updateStatusFilter(\"all\")");
assertIncludes(preRegistrationsPanel, "setDashboardSourceApplied(false)");
assertIncludes(api, "status?: PreRegistrationStatus | \"all\"");

assertIncludes(dashboardService, "readDashboardPart");
assertIncludes(dashboardService, "blockStatus(");
assert.ok(
  !dashboardService.includes("\"missingDrivers\""),
  "Dashboard must not expose missing-driver metric without a driver model",
);

console.log("Dashboard operational panel guard OK");

function assertIncludes(source, fragment) {
  assert.ok(source.includes(fragment), `Expected source to include ${fragment}`);
}
