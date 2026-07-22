import "reflect-metadata";
import assert from "node:assert/strict";
import {
  ForbiddenException,
  RequestMethod,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  BankSlipStatus,
  PreRegistrationStatus,
  RoleCode,
  StudentDocumentType,
  StudentStatus,
  UserStatus,
} from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

const now = new Date("2026-07-22T12:00:00.000Z");
const SUPER_ADMIN: AuthUser = {
  id: "user-super",
  name: "Super Admin",
  email: "super@example.com",
  status: UserStatus.ACTIVE,
  roles: [RoleCode.SUPER_ADMIN],
};
const SECRETARIA: AuthUser = {
  id: "user-secretaria",
  name: "Secretaria",
  email: "secretaria@example.com",
  status: UserStatus.ACTIVE,
  roles: [RoleCode.SECRETARIA],
};
const UNAUTHORIZED_ROLE_USER: AuthUser = {
  id: "user-none",
  name: "Sem Papel",
  email: "none@example.com",
  status: UserStatus.ACTIVE,
  roles: [],
};

const GUARDS_METADATA_KEY = "__guards__";
const METHOD_METADATA_KEY = "method";
const PATH_METADATA_KEY = "path";

await testControllerRouteGuardsAndRoles();
await testAuthGuardBlocksUnauthenticatedUser();
await testRolesGuardAllowsSuperAdminAndSecretaria();
await testRolesGuardBlocksUnauthorizedRole();
await testControllerPassesQueryAndAuthenticatedUser();
await testEmptyOverviewStructure();
await testOverviewWithAggregatedData();
await testFiltersAreApplied();

async function testControllerRouteGuardsAndRoles() {
  const classGuards = Reflect.getMetadata(
    GUARDS_METADATA_KEY,
    DashboardController,
  ) as unknown[];

  assert.deepEqual(classGuards, [AuthGuard, RolesGuard]);
  assert.equal(
    Reflect.getMetadata(PATH_METADATA_KEY, DashboardController),
    "dashboard",
  );
  assert.equal(
    Reflect.getMetadata(
      PATH_METADATA_KEY,
      DashboardController.prototype.overview,
    ),
    "overview",
  );
  assert.equal(
    Reflect.getMetadata(
      METHOD_METADATA_KEY,
      DashboardController.prototype.overview,
    ),
    RequestMethod.GET,
  );
  assert.deepEqual(
    Reflect.getMetadata("roles", DashboardController.prototype.overview),
    [RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA],
  );
}

async function testAuthGuardBlocksUnauthenticatedUser() {
  const guard = new AuthGuard({} as never, {} as never);
  await assert.rejects(
    () =>
      guard.canActivate(
        httpContext({
          cookies: {},
          headers: {},
        }),
      ),
    UnauthorizedException,
  );
}

async function testRolesGuardAllowsSuperAdminAndSecretaria() {
  const guard = new RolesGuard(new Reflector());
  assert.equal(
    guard.canActivate(
      httpContext({ user: SUPER_ADMIN }, DashboardController.prototype.overview),
    ),
    true,
  );
  assert.equal(
    guard.canActivate(
      httpContext({ user: SECRETARIA }, DashboardController.prototype.overview),
    ),
    true,
  );
}

async function testRolesGuardBlocksUnauthorizedRole() {
  const guard = new RolesGuard(new Reflector());
  assert.throws(
    () =>
      guard.canActivate(
        httpContext(
          { user: UNAUTHORIZED_ROLE_USER },
          DashboardController.prototype.overview,
        ),
      ),
    ForbiddenException,
  );
}

async function testControllerPassesQueryAndAuthenticatedUser() {
  const service = {
    calls: [] as unknown[],
    overview: { ok: true },
    getOverview(query: unknown, user: AuthUser) {
      this.calls.push({ query, user });
      return this.overview;
    },
  };
  const controller = new DashboardController(service as never);
  const query = {
    academicYearId: "11111111-1111-4111-8111-111111111111",
    institutionId: "22222222-2222-4222-8222-222222222222",
  };

  assert.equal(controller.overview(query, SUPER_ADMIN), service.overview);
  assert.deepEqual(service.calls, [{ query, user: SUPER_ADMIN }]);
}

async function testEmptyOverviewStructure() {
  const { service } = makeDashboardService("empty");
  const overview = await service.getOverview({}, SECRETARIA);

  assert.equal(overview.academicYear, null);
  assert.equal(overview.indicators.activeStudents.value, 0);
  assert.equal(overview.indicators.pendingPreRegistrations.value, 0);
  assert.equal(overview.indicators.overdueAmount.value, 0);
  assert.equal(overview.indicators.overdueInvoices.value, 0);
  assert.equal(overview.indicators.bankSlipsAttention.value, 0);
  assert.equal(overview.indicators.busSeats.value, 0);
  assert.equal(overview.indicators.pendingStudentCards.value, 0);
  assert.equal(overview.indicators.incompleteDocuments.value, 0);
  assert.deepEqual(overview.agendaToday.collectionFollowUps, []);
  assert.deepEqual(overview.criticalAlerts, []);
  assert.deepEqual(overview.financeAndCollections.criticalCases, []);
  assert.deepEqual(overview.academicsAndDocuments.recentItems, []);
  assert.deepEqual(overview.busesAndSeats.attentionBuses, []);
  assert.deepEqual(overview.preRegistrations.pendingItems, []);
  assert.deepEqual(overview.pendingStudentCards.items, []);
  assert.equal(overview.charts.overdueByAgingBucket.data.length, 4);
  assert.deepEqual(overview.charts.occupancyByBus.data, []);
  assert.deepEqual(overview.charts.studentsByInstitution.data, []);
  assert.equal(overview.charts.preRegistrationsByMonth.data.length, 6);
  assert.ok(overview.quickShortcuts.some((item) => item.key === "collections"));
}

async function testOverviewWithAggregatedData() {
  const { service, calls } = makeDashboardService("populated");
  const overview = await service.getOverview({}, SUPER_ADMIN);

  assert.match(overview.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(overview.academicYear?.year, 2026);
  assert.equal(overview.indicators.activeStudents.value, 12);
  assert.equal(overview.indicators.pendingPreRegistrations.value, 3);
  assert.equal(overview.indicators.overdueAmount.value, 25000);
  assert.equal(overview.indicators.overdueAmount.formattedValue, "R$ 250,00");
  assert.equal(overview.indicators.overdueInvoices.value, 2);
  assert.equal(overview.indicators.bankSlipsAttention.value, 1);
  assert.equal(overview.indicators.busSeats.value, 40);
  assert.equal(overview.indicators.pendingStudentCards.value, 5);
  assert.equal(overview.indicators.incompleteDocuments.value, 1);
  assert.equal(
    overview.indicators.incompleteDocuments.label,
    "Cadastros com documentacao incompleta",
  );
  assert.equal(overview.agendaToday.collectionFollowUps.length, 1);
  assert.equal(overview.financeAndCollections.criticalCases.length, 1);
  assert.equal(overview.academicsAndDocuments.recentItems.length, 1);
  assert.equal(
    overview.academicsAndDocuments.recentItems[0]?.metadata?.missingCount,
    3,
  );
  assert.equal(overview.busesAndSeats.attentionBuses.length, 1);
  assert.equal(overview.preRegistrations.pendingItems.length, 1);
  assert.equal(overview.pendingStudentCards.items.length, 1);
  assert.equal(overview.charts.overdueByAgingBucket.data[0]?.value, 1);
  assert.equal(overview.charts.occupancyByBus.data[0]?.busId, "bus-1");
  assert.equal(overview.charts.occupancyByBus.data[0]?.label, "Onibus 1");
  assert.equal(overview.charts.occupancyByBus.data[0]?.capacity, 40);
  assert.equal(overview.charts.occupancyByBus.data[0]?.occupiedSeats, 40);
  assert.equal(overview.charts.occupancyByBus.data[0]?.availableSeats, 0);
  assert.equal(overview.charts.occupancyByBus.data[0]?.occupancyPercent, 100);
  assert.equal(overview.charts.occupancyByBus.data[0]?.status, "FULL");
  assert.equal(
    overview.charts.studentsByInstitution.data[0]?.label,
    "Instituicao A",
  );
  assert.equal(overview.charts.studentsByInstitution.data[0]?.value, 12);
  assert.equal(overview.charts.preRegistrationsByMonth.data.length, 6);
  assert.equal(calls.collections.getSummary.length, 1);
  assert.equal(calls.collections.listCases.length, 1);
  assert.equal(calls.collections.listFollowUps.length, 1);
  assert.equal(calls.sicredi.length, 0);
  assert.equal(calls.writes.length, 0);
}

async function testFiltersAreApplied() {
  const { service, calls } = makeDashboardService("populated");
  const query = {
    academicYearId: "11111111-1111-4111-8111-111111111111",
    institutionId: "22222222-2222-4222-8222-222222222222",
  };

  await service.getOverview(query, SUPER_ADMIN);

  assert.deepEqual(calls.collections.getSummary[0]?.filters, query);
  assert.deepEqual(calls.collections.listCases[0]?.filters, {
    ...query,
    page: 1,
    limit: 20,
  });
  assert.equal(
    hasNestedValue(calls.prisma.studentCount[0], query.academicYearId),
    true,
  );
  assert.equal(
    hasNestedValue(calls.prisma.studentCount[0], query.institutionId),
    true,
  );
  assert.equal(
    hasNestedValue(calls.prisma.preRegistrationCount[0], query.academicYearId),
    true,
  );
  assert.equal(
    hasNestedValue(calls.prisma.preRegistrationCount[0], query.institutionId),
    true,
  );
  assert.equal(hasNestedValue(calls.prisma.bankSlipCount[0], query.institutionId), true);
  assert.equal(hasNestedValue(calls.prisma.enrollmentCount[0], query.academicYearId), true);
  assert.equal(hasNestedValue(calls.prisma.enrollmentCount[0], query.institutionId), true);
}

function makeDashboardService(mode: "empty" | "populated") {
  const calls = {
    collections: {
      getSummary: [] as Array<{ filters: unknown; user: AuthUser }>,
      listCases: [] as Array<{
        filters: unknown;
        pagination: unknown;
        user: AuthUser;
      }>,
      listFollowUps: [] as Array<{ filters: unknown; user: AuthUser }>,
    },
    prisma: {
      studentCount: [] as unknown[],
      preRegistrationCount: [] as unknown[],
      bankSlipCount: [] as unknown[],
      enrollmentCount: [] as unknown[],
    },
    sicredi: [] as unknown[],
    writes: [] as unknown[],
  };
  const empty = mode === "empty";

  const prisma = {
    academicYear: {
      findUnique: async () => null,
      findFirst: async () =>
        empty
          ? null
          : {
              id: "year-1",
              year: 2026,
              isCurrent: true,
            },
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    student: {
      count: async (args: unknown) => {
        calls.prisma.studentCount.push(args);
        return empty ? 0 : 12;
      },
      groupBy: async () =>
        empty
          ? []
          : [
              { status: StudentStatus.ACTIVE, _count: { _all: 12 } },
              { status: StudentStatus.SUSPENDED, _count: { _all: 2 } },
            ],
      findMany: async () =>
        empty
          ? []
          : [
              {
                id: "student-1",
                person: { fullName: "Aluno Um" },
                documents: [
                  { documentType: StudentDocumentType.CPF },
                ],
                enrollments: [
                  {
                    institution: { name: "Instituicao A" },
                    academicYear: { year: 2026 },
                  },
                ],
              },
            ],
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    publicPreRegistration: {
      count: async (args: unknown) => {
        calls.prisma.preRegistrationCount.push(args);
        return empty ? 0 : 3;
      },
      groupBy: async () =>
        empty
          ? []
          : [
              { status: PreRegistrationStatus.PENDING, _count: { _all: 3 } },
              { status: PreRegistrationStatus.APPROVED, _count: { _all: 4 } },
            ],
      findMany: async (args: { select?: { publicCode?: boolean } }) =>
        empty
          ? []
          : !args.select?.publicCode
            ? [{ createdAt: now }]
            : [
                {
                  id: "pre-1",
                  publicCode: "PRE001",
                  fullName: "Pre Cadastro",
                  createdAt: now,
                  institution: { name: "Instituicao A" },
                },
              ],
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    bankSlip: {
      count: async (args: unknown) => {
        calls.prisma.bankSlipCount.push(args);
        return empty ? 0 : 1;
      },
      findMany: async () =>
        empty
          ? []
          : [
              {
                id: "slip-1",
                status: BankSlipStatus.ISSUE_FAILED,
                updatedAt: now,
                invoice: {
                  id: "invoice-1",
                  amountCents: 15000,
                  dueDate: now,
                  student: { person: { fullName: "Aluno Um" } },
                  enrollment: { institution: { name: "Instituicao A" } },
                },
              },
            ],
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    bus: {
      aggregate: async () =>
        empty ? { _count: { _all: 0 }, _sum: { capacity: null } } : { _count: { _all: 2 }, _sum: { capacity: 80 } },
      findMany: async () =>
        empty
          ? []
          : [
              { id: "bus-1", name: "Onibus 1", capacity: 40 },
              { id: "bus-2", name: "Onibus 2", capacity: 40 },
            ],
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    busAssignment: {
      groupBy: async () =>
        empty ? [] : [{ busId: "bus-1", _count: { _all: 40 } }],
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    enrollment: {
      count: async (args: unknown) => {
        calls.prisma.enrollmentCount.push(args);
        return empty ? 0 : 5;
      },
      findMany: async () =>
        empty
          ? []
          : [
              {
                id: "enrollment-1",
                createdAt: now,
                student: { id: "student-1", person: { fullName: "Aluno Um" } },
                institution: { name: "Instituicao A" },
                academicYear: { year: 2026 },
              },
            ],
      groupBy: async () =>
        empty ? [] : [{ institutionId: "institution-1", _count: { _all: 12 } }],
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    institution: {
      findMany: async () =>
        empty ? [] : [{ id: "institution-1", name: "Instituicao A" }],
      create: writeTrap(calls),
      update: writeTrap(calls),
      delete: writeTrap(calls),
    },
    $transaction: writeTrap(calls),
  };

  const collections = {
    getSummary: async (filters: unknown, user: AuthUser) => {
      calls.collections.getSummary.push({ filters, user });
      return empty
        ? emptyCollectionSummary()
        : {
            totalOverdueCents: 25000,
            invoiceCount: 2,
            studentCount: 2,
            averageOverdueAmountCents: 12500,
            agingBuckets: {
              DAYS_1_30: 1,
              DAYS_31_60: 1,
              DAYS_61_90: 0,
              DAYS_90_PLUS: 0,
            },
            promisesActiveCount: 0,
            promisesBrokenCount: 1,
            followUpsTodayCount: 1,
            partialPaymentReviewCount: 1,
          };
    },
    listCases: async (filters: unknown, pagination: unknown, user: AuthUser) => {
      calls.collections.listCases.push({ filters, pagination, user });
      return {
        data: empty
          ? []
          : [
              {
                invoiceId: "invoice-1",
                priority: "CRITICAL",
                daysOverdue: 40,
                dueDate: "2026-06-12",
                outstandingAmountCents: 15000,
                operationalStatus: "PROMISE_BROKEN",
                student: { person: { fullName: "Aluno Um" } },
                enrollment: { institution: { name: "Instituicao A" } },
              },
            ],
        pagination: { page: 1, limit: 20, total: empty ? 0 : 1, totalPages: 1 },
      };
    },
    listFollowUps: async (filters: unknown, user: AuthUser) => {
      calls.collections.listFollowUps.push({ filters, user });
      return {
        data: empty
          ? []
          : [
              {
                invoiceId: "invoice-1",
                priority: "CRITICAL",
                daysOverdue: 40,
                dueDate: "2026-06-12",
                outstandingAmountCents: 15000,
                operationalStatus: "PROMISE_BROKEN",
                nextFollowUpAt: now,
                student: { person: { fullName: "Aluno Um" } },
                enrollment: { institution: { name: "Instituicao A" } },
              },
            ],
      };
    },
  };

  return {
    service: new DashboardService(prisma as never, collections as never),
    calls,
  };
}

function emptyCollectionSummary() {
  return {
    totalOverdueCents: 0,
    invoiceCount: 0,
    studentCount: 0,
    averageOverdueAmountCents: 0,
    agingBuckets: {
      DAYS_1_30: 0,
      DAYS_31_60: 0,
      DAYS_61_90: 0,
      DAYS_90_PLUS: 0,
    },
    promisesActiveCount: 0,
    promisesBrokenCount: 0,
    followUpsTodayCount: 0,
    partialPaymentReviewCount: 0,
  };
}

function writeTrap(calls: { writes: unknown[] }) {
  return async (...args: unknown[]) => {
    calls.writes.push(args);
    throw new Error("Dashboard tests must not write to the database");
  };
}

function hasNestedValue(value: unknown, expected: string) {
  return JSON.stringify(value).includes(expected);
}

function httpContext(request: unknown, handler = DashboardController.prototype.overview) {
  return {
    getHandler: () => handler,
    getClass: () => DashboardController,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
