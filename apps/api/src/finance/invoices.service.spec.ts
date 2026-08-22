import assert from "node:assert/strict";
import {
  AcademicYearStatus,
  BankSlipStatus,
  EnrollmentStatus,
  InvoiceStatus,
  RoleCode,
  StudentStatus,
  UserStatus,
} from "@prisma/client";
import { InvoicesService } from "./invoices.service.js";
import type { AuthUser } from "../users/users.service.js";

async function testListInvoicesIncludesBankSlipSummaryWithoutNPlusOne() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "invoice-without-slip", bankSlip: null }),
    invoiceRecord({ id: "invoice-issued", bankSlipStatus: BankSlipStatus.ISSUED }),
    invoiceRecord({
      id: "invoice-paid",
      bankSlipStatus: BankSlipStatus.PAID,
      status: InvoiceStatus.PAID,
    }),
    invoiceRecord({
      id: "invoice-cancelled",
      bankSlipStatus: BankSlipStatus.CANCELLED,
      status: InvoiceStatus.CANCELLED,
    }),
    invoiceRecord({ id: "invoice-unknown", bankSlipStatus: BankSlipStatus.UNKNOWN }),
  ]);
  const service = new InvoicesService(prisma as never);

  const result = await service.listInvoices({
    page: 2,
    limit: 2,
    search: "Academico",
    overdue: "overdue",
    institutionId: "institution-1",
    academicYearId: "academic-year-1",
    status: InvoiceStatus.OPEN,
    sort: "createdAt",
    order: "asc",
  } as never);

  assert.equal(prisma.invoice.findManyCalls.length, 1);
  assert.equal(prisma.invoice.countCalls.length, 1);
  assert.equal(prisma.invoice.groupByCalls.length, 1);
  assert.equal(prisma.invoice.aggregateCalls.length, 1);
  assert.equal(prisma.bankSlip.aggregateCalls.length, 1);
  assert.equal(prisma.bankSlip.countCalls.length, 1);
  assert.equal(prisma.bankSlip.findUniqueCalls.length, 0);
  assert.equal(prisma.invoice.findManyCalls[0]?.skip, 2);
  assert.equal(prisma.invoice.findManyCalls[0]?.take, 2);
  assert.deepEqual(
    prisma.invoice.countCalls[0]?.where,
    prisma.invoice.findManyCalls[0]?.where,
  );
  assert.match(JSON.stringify(prisma.invoice.findManyCalls[0]?.where), /dueDate/);
  assert.match(
    JSON.stringify(prisma.invoice.findManyCalls[0]?.where),
    /institution-1/,
  );
  assert.match(
    JSON.stringify(prisma.invoice.findManyCalls[0]?.where),
    /academic-year-1/,
  );
  assert.match(JSON.stringify(prisma.invoice.findManyCalls[0]?.where), /Academico/i);
  const include = prisma.invoice.findManyCalls[0]?.include as Record<
    string,
    { select?: Record<string, boolean> }
  >;
  assert.deepEqual(
    Object.keys(include.bankSlip?.select ?? {}),
    [
      "id",
      "status",
      "nossoNumero",
      "issuedAt",
      "paidAmountCents",
      "paidAt",
      "cancelledAt",
      "lastCheckedAt",
    ],
  );
  assert.equal(result.pagination.total, 5);
  assert.equal(result.pagination.totalPages, 3);
  assert.equal(result.summary.loadedInvoiceCount, 5);
  assert.equal(result.summary.totalFilteredInvoiceCount, 5);
  assert.equal(result.summary.openAmountCents, 36_150);
  assert.equal(result.summary.overdueAmountCents, 36_150);
  assert.equal(result.summary.paidAmountCents, 0);
  assert.equal(result.summary.cancelledAmountCents, 0);
  assert.equal(result.summary.failedBankSlips, 1);
  const bankSlipCountWhere = prisma.bankSlip.countCalls[0]?.where as
    | { invoice?: unknown }
    | undefined;
  assert.equal(
    bankSlipCountWhere?.invoice,
    prisma.invoice.findManyCalls[0]?.where,
  );
  assert.match(JSON.stringify(prisma.invoice.aggregateCalls), /academic-year-1/);
  assert.equal(result.data[0]?.bankSlipSummary, null);
  assert.equal(result.data[1]?.bankSlipSummary?.status, BankSlipStatus.ISSUED);
  assert.equal(result.data[2]?.bankSlipSummary?.status, BankSlipStatus.PAID);
  assert.equal(result.data[3]?.bankSlipSummary?.status, BankSlipStatus.CANCELLED);
  assert.equal(result.data[4]?.bankSlipSummary?.status, BankSlipStatus.UNKNOWN);
  assert.equal(result.data[1]?.bankSlipSummary?.nossoNumeroMasked, "******142");
  assert.equal(
    (result.data[1]?.bankSlipSummary as Record<string, unknown>).linhaDigitavel,
    undefined,
  );
  assert.equal(
    (result.data[1]?.bankSlipSummary as Record<string, unknown>).codigoBarras,
    undefined,
  );
  assert.equal(
    (result.data[1]?.bankSlipSummary as Record<string, unknown>).providerErrorMessage,
    undefined,
  );
}

async function testStudentInvoicesReuseAggregatedBankSlipSummary() {
  const prisma = new FakePrisma();
  const service = new InvoicesService(prisma as never);

  const result = await service.listStudentInvoices("student-1");

  assert.equal(prisma.student.findUniqueCalls.length, 1);
  assert.equal(prisma.invoice.findManyCalls.length, 1);
  assert.equal(prisma.bankSlip.findUniqueCalls.length, 0);
  assert.equal(result.data[0]?.bankSlipSummary?.id, "bank-slip-invoice-1");
}

async function testAdministratorListsInvoicesWithoutInstitutionProfile() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "invoice-1", institutionId: "institution-1" }),
    invoiceRecord({ id: "invoice-2", institutionId: "institution-2" }),
  ], { applyQuery: true });
  const service = new InvoicesService(prisma as never);
  const administrator: AuthUser = {
    email: "administrator@example.com",
    id: "administrator-1",
    institutionIds: [],
    name: "Administrator",
    permissionProfileId: null,
    roles: [RoleCode.ADMINISTRATOR],
    status: UserStatus.ACTIVE,
  };

  const result = await service.listInvoices(
    {
      overdue: "all",
      page: 1,
      limit: 10,
      sort: "createdAt",
      order: "asc",
    } as never,
    administrator,
  );

  assert.equal(result.pagination.total, 2);
  assert.deepEqual(
    result.data.map((invoice) => invoice.id),
    ["invoice-1", "invoice-2"],
  );
  assert.doesNotMatch(
    JSON.stringify(prisma.invoice.findManyCalls[0]?.where),
    /institutionId/,
  );
}

async function testListInvoicesSummaryUsesAllFilteredInvoices() {
  const matchingInvoices = [
    invoiceRecord({
      id: "match-open-overdue-1",
      amountCents: 1_000,
      dueDate: "2026-06-01",
      searchName: "Resumo Financeiro 1",
      bankSlipStatus: BankSlipStatus.ISSUE_FAILED,
    }),
    invoiceRecord({
      id: "match-open-overdue-2",
      amountCents: 2_000,
      dueDate: "2026-06-02",
      searchName: "Resumo Financeiro 2",
    }),
    invoiceRecord({
      id: "match-open-overdue-3",
      amountCents: 3_000,
      dueDate: "2026-06-03",
      searchName: "Resumo Financeiro 3",
    }),
    invoiceRecord({
      id: "match-open-overdue-4",
      amountCents: 4_000,
      dueDate: "2026-06-04",
      searchName: "Resumo Financeiro 4",
    }),
    invoiceRecord({
      id: "match-open-overdue-5",
      amountCents: 5_000,
      dueDate: "2026-06-05",
      searchName: "Resumo Financeiro 5",
    }),
    invoiceRecord({
      id: "match-open-future-1",
      amountCents: 6_000,
      dueDate: "2026-12-01",
      searchName: "Resumo Financeiro 6",
    }),
    invoiceRecord({
      id: "match-open-future-2",
      amountCents: 7_000,
      dueDate: "2026-12-02",
      searchName: "Resumo Financeiro 7",
    }),
    invoiceRecord({
      id: "match-open-future-3",
      amountCents: 8_000,
      dueDate: "2026-12-03",
      searchName: "Resumo Financeiro 8",
    }),
    invoiceRecord({
      id: "match-paid-1",
      amountCents: 9_000,
      dueDate: "2026-06-06",
      searchName: "Resumo Financeiro 9",
      status: InvoiceStatus.PAID,
      bankSlip: bankSlipRecord({
        invoiceId: "match-paid-1",
        paidAmountCents: 9_000,
        status: BankSlipStatus.PAID,
      }),
    }),
    invoiceRecord({
      id: "match-paid-2",
      amountCents: 10_000,
      dueDate: "2026-06-07",
      searchName: "Resumo Financeiro 10",
      status: InvoiceStatus.PAID,
      bankSlip: bankSlipRecord({
        invoiceId: "match-paid-2",
        paidAmountCents: 10_000,
        status: BankSlipStatus.PAID,
      }),
    }),
    invoiceRecord({
      id: "match-cancelled-1",
      amountCents: 11_000,
      dueDate: "2026-06-08",
      searchName: "Resumo Financeiro 11",
      status: InvoiceStatus.CANCELLED,
      bankSlipStatus: BankSlipStatus.CANCELLED,
    }),
    invoiceRecord({
      id: "match-cancelled-2",
      amountCents: 12_000,
      dueDate: "2026-06-09",
      searchName: "Resumo Financeiro 12",
      status: InvoiceStatus.CANCELLED,
      bankSlipStatus: BankSlipStatus.CANCELLATION_FAILED,
    }),
  ];
  const prisma = new FakePrisma(
    [
      ...matchingInvoices,
      invoiceRecord({
        id: "outside-year",
        amountCents: 90_000,
        dueDate: "2026-06-10",
        searchName: "Resumo Financeiro fora ano",
        academicYearId: "academic-year-2",
      }),
      invoiceRecord({
        id: "outside-institution",
        amountCents: 91_000,
        dueDate: "2026-06-10",
        searchName: "Resumo Financeiro fora instituicao",
        institutionId: "institution-2",
      }),
      invoiceRecord({
        id: "outside-period",
        amountCents: 92_000,
        dueDate: "2026-05-31",
        searchName: "Resumo Financeiro fora periodo",
      }),
      invoiceRecord({
        id: "outside-search",
        amountCents: 93_000,
        dueDate: "2026-06-10",
        searchName: "Outro Academico",
      }),
    ],
    { applyQuery: true },
  );
  const service = new InvoicesService(prisma as never);

  const firstPage = await service.listInvoices({
    page: 1,
    limit: 10,
    search: "Resumo",
    overdue: "all",
    institutionId: "institution-1",
    academicYearId: "academic-year-1",
    dueDateFrom: "2026-06-01",
    dueDateTo: "2026-12-31",
    sort: "createdAt",
    order: "asc",
  } as never);
  const secondPage = await service.listInvoices({
    page: 2,
    limit: 10,
    search: "Resumo",
    overdue: "all",
    institutionId: "institution-1",
    academicYearId: "academic-year-1",
    dueDateFrom: "2026-06-01",
    dueDateTo: "2026-12-31",
    sort: "createdAt",
    order: "asc",
  } as never);
  const paidOnly = await service.listInvoices({
    page: 1,
    limit: 10,
    search: "Resumo",
    overdue: "all",
    institutionId: "institution-1",
    academicYearId: "academic-year-1",
    dueDateFrom: "2026-06-01",
    dueDateTo: "2026-12-31",
    status: InvoiceStatus.PAID,
    sort: "createdAt",
    order: "asc",
  } as never);
  const overdueOnly = await service.listInvoices({
    page: 1,
    limit: 10,
    search: "Resumo",
    overdue: "overdue",
    institutionId: "institution-1",
    academicYearId: "academic-year-1",
    dueDateFrom: "2026-06-01",
    dueDateTo: "2026-12-31",
    sort: "createdAt",
    order: "asc",
  } as never);

  assert.equal(firstPage.data.length, 10);
  assert.equal(firstPage.pagination.total, 12);
  assert.equal(firstPage.summary.loadedInvoiceCount, 10);
  assert.equal(firstPage.summary.totalFilteredInvoiceCount, 12);
  assert.equal(firstPage.summary.openAmountCents, 36_000);
  assert.equal(firstPage.summary.overdueAmountCents, 15_000);
  assert.equal(firstPage.summary.paidAmountCents, 19_000);
  assert.equal(firstPage.summary.cancelledAmountCents, 23_000);
  assert.equal(firstPage.summary.failedBankSlips, 2);

  assert.equal(secondPage.data.length, 2);
  assert.equal(secondPage.pagination.total, 12);
  assert.deepEqual(secondPage.summary, {
    ...firstPage.summary,
    loadedInvoiceCount: 2,
  });

  assert.equal(paidOnly.pagination.total, 2);
  assert.equal(paidOnly.summary.openAmountCents, 0);
  assert.equal(paidOnly.summary.overdueAmountCents, 0);
  assert.equal(paidOnly.summary.paidAmountCents, 19_000);
  assert.equal(paidOnly.summary.cancelledAmountCents, 0);

  assert.equal(overdueOnly.pagination.total, 5);
  assert.equal(overdueOnly.summary.openAmountCents, 15_000);
  assert.equal(overdueOnly.summary.overdueAmountCents, 15_000);
  assert.equal(overdueOnly.summary.paidAmountCents, 0);
  assert.equal(overdueOnly.summary.cancelledAmountCents, 0);
}

async function testListInvoicesFiltersPaidInvoicesByPaymentDate() {
  const prisma = new FakePrisma(
    [
      invoiceRecord({
        id: "old-year-paid-this-month",
        amountCents: 10_000,
        academicYearId: "academic-year-old",
        bankSlip: bankSlipRecord({
          invoiceId: "old-year-paid-this-month",
          paidAmountCents: 9_000,
          paidAt: new Date("2026-07-05T10:00:00.000Z"),
          status: BankSlipStatus.PAID,
        }),
        status: InvoiceStatus.PAID,
      }),
      invoiceRecord({
        id: "paid-outside-month",
        amountCents: 20_000,
        bankSlip: bankSlipRecord({
          invoiceId: "paid-outside-month",
          paidAmountCents: 20_000,
          paidAt: new Date("2026-06-30T23:59:59.000Z"),
          status: BankSlipStatus.PAID,
        }),
        status: InvoiceStatus.PAID,
      }),
      invoiceRecord({
        id: "paid-without-paid-at",
        amountCents: 30_000,
        bankSlip: bankSlipRecord({
          invoiceId: "paid-without-paid-at",
          paidAmountCents: 30_000,
          paidAt: null,
          status: BankSlipStatus.PAID,
        }),
        status: InvoiceStatus.PAID,
      }),
      invoiceRecord({
        id: "unpaid-this-month",
        amountCents: 40_000,
        bankSlipStatus: BankSlipStatus.ISSUED,
        status: InvoiceStatus.OPEN,
      }),
      invoiceRecord({
        id: "other-institution",
        amountCents: 50_000,
        bankSlip: bankSlipRecord({
          invoiceId: "other-institution",
          paidAmountCents: 50_000,
          paidAt: new Date("2026-07-07T10:00:00.000Z"),
          status: BankSlipStatus.PAID,
        }),
        institutionId: "institution-2",
        status: InvoiceStatus.PAID,
      }),
    ],
    { applyQuery: true },
  );
  const service = new InvoicesService(prisma as never);

  const result = await service.listInvoices({
    page: 1,
    limit: 10,
    institutionId: "institution-1",
    overdue: "all",
    paidAtFrom: "2026-07-01",
    paidAtTo: "2026-07-31",
    status: InvoiceStatus.PAID,
    sort: "createdAt",
    order: "asc",
  } as never);

  assert.deepEqual(
    result.data.map((invoice) => invoice.id),
    ["old-year-paid-this-month"],
  );
  assert.equal(result.data[0]?.bankSlipSummary?.paidAmountCents, 9_000);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.summary.paidAmountCents, 9_000);
  assert.equal(hasNestedPaidAtFilter(prisma.invoice.findManyCalls[0]?.where), true);
  assert.equal(hasNestedValue(prisma.invoice.findManyCalls[0]?.where, "PAID"), true);
  assert.equal(
    hasNestedValue(prisma.invoice.findManyCalls[0]?.where, "academic-year-old"),
    false,
  );
  assert.equal(hasNestedValue(prisma.invoice.findManyCalls[0]?.where, "institution-1"), true);
}

async function testListInvoicesUsesOperationalOrderBeforePagination() {
  const prisma = new FakePrisma(
    [
      invoiceRecord({ id: "paid", dueDate: "2026-06-01", status: InvoiceStatus.PAID, bankSlip: bankSlipRecord({
        invoiceId: "paid",
        paidAt: new Date("2026-07-14T18:00:00.000Z"),
        status: BankSlipStatus.PAID,
      }) }),
      invoiceRecord({ id: "cancelled", dueDate: "2026-06-01", status: InvoiceStatus.CANCELLED }),
      invoiceRecord({ id: "due-tomorrow", dueDate: "2026-07-16" }),
      invoiceRecord({ id: "overdue-recent", dueDate: "2026-07-10" }),
      invoiceRecord({ id: "future", dueDate: "2026-07-22" }),
      invoiceRecord({ id: "due-today", dueDate: "2026-07-15" }),
      invoiceRecord({ id: "overdue-old", dueDate: "2026-06-25" }),
    ],
    { applyQuery: true },
  );
  const service = new InvoicesService(prisma as never);
  (service as unknown as { todayProvider: () => Date }).todayProvider = () =>
    new Date("2026-07-15T12:00:00.000Z");

  const firstPage = await service.listInvoices({
    page: 1,
    limit: 5,
    overdue: "all",
    sort: "dueDate",
    order: "asc",
  } as never);
  const secondPage = await service.listInvoices({
    page: 2,
    limit: 5,
    overdue: "all",
    sort: "dueDate",
    order: "asc",
  } as never);

  assert.deepEqual(
    firstPage.data.map((invoice) => invoice.id),
    ["overdue-old", "overdue-recent", "due-today", "due-tomorrow", "future"],
  );
  assert.deepEqual(
    secondPage.data.map((invoice) => invoice.id),
    ["paid", "cancelled"],
  );
  assert.equal(firstPage.pagination.total, 7);
  assert.equal(secondPage.pagination.total, 7);
  assert.match(JSON.stringify(prisma.invoice.findManyCalls[0]?.where), /"id"/);
  assert.equal(prisma.invoice.findManyCalls[0]?.skip, undefined);
}

class FakePrisma {
  readonly invoiceRecords: ReturnType<typeof invoiceRecord>[];
  readonly applyQuery: boolean;

  constructor(records = [invoiceRecord()], options: { applyQuery?: boolean } = {}) {
    this.invoiceRecords = records;
    this.applyQuery = options.applyQuery ?? false;
    this.invoice.findManyCalls = [];
    this.invoice.countCalls = [];
    this.invoice.aggregateCalls = [];
    this.invoice.groupByCalls = [];
  }

  invoice = {
    findMany: async (args: Record<string, unknown>) => {
      this.invoice.findManyCalls.push(args);
      const records = this.filterInvoices(args.where);
      if (!this.applyQuery) {
        return records;
      }
      const skip = typeof args.skip === "number" ? args.skip : 0;
      const take = typeof args.take === "number" ? args.take : records.length;
      return records.slice(skip, skip + take);
    },
    count: async (args: Record<string, unknown>) => {
      this.invoice.countCalls.push(args);
      return this.filterInvoices(args.where).length;
    },
    aggregate: async (args: Record<string, unknown>) => {
      this.invoice.aggregateCalls.push(args);
      const total = this.invoiceRecords
        .filter((record) => matchesInvoiceWhere(record, args.where))
        .reduce((sum, invoice) => sum + invoice.amountCents, 0);
      return { _sum: { amountCents: total } };
    },
    groupBy: async (args: Record<string, unknown>) => {
      this.invoice.groupByCalls.push(args);
      const totals = new Map<InvoiceStatus, number>();
      for (const invoice of this.invoiceRecords) {
        if (!matchesInvoiceWhere(invoice, args.where)) {
          continue;
        }
        totals.set(
          invoice.status,
          (totals.get(invoice.status) ?? 0) + invoice.amountCents,
        );
      }
      return Array.from(totals, ([status, amountCents]) => ({
        status,
        _sum: { amountCents },
      }));
    },
  } as {
    findMany: ((args: Record<string, unknown>) => Promise<unknown[]>) & {
      findManyCalls?: unknown[];
    };
    count: ((args: Record<string, unknown>) => Promise<number>) & {
      countCalls?: unknown[];
    };
    aggregate: ((args: Record<string, unknown>) => Promise<unknown>) & {
      aggregateCalls?: unknown[];
    };
    groupBy: ((args: Record<string, unknown>) => Promise<unknown>) & {
      groupByCalls?: unknown[];
    };
    findManyCalls: Record<string, unknown>[];
    countCalls: Record<string, unknown>[];
    aggregateCalls: Record<string, unknown>[];
    groupByCalls: Record<string, unknown>[];
  };

  student = {
    findUnique: async (args: Record<string, unknown>) => {
      this.student.findUniqueCalls.push(args);
      return { id: "student-1" };
    },
    findUniqueCalls: [] as Record<string, unknown>[],
  };

  bankSlip = {
    findUnique: async (args: Record<string, unknown>) => {
      this.bankSlip.findUniqueCalls.push(args);
      return null;
    },
    findUniqueCalls: [] as Record<string, unknown>[],
    aggregate: async (args: Record<string, unknown>) => {
      this.bankSlip.aggregateCalls.push(args);
      const where = args.where as { invoice?: unknown; status?: BankSlipStatus } | undefined;
      const total = this.invoiceRecords
        .filter(
          (invoice) =>
            matchesInvoiceWhere(invoice, where?.invoice) &&
            (!where?.status || invoice.bankSlip?.status === where.status),
        )
        .reduce((sum, invoice) => sum + (invoice.bankSlip?.paidAmountCents ?? 0), 0);
      return { _sum: { paidAmountCents: total } };
    },
    aggregateCalls: [] as Record<string, unknown>[],
    count: async (args: Record<string, unknown>) => {
      this.bankSlip.countCalls.push(args);
      const where = args.where as { invoice?: unknown } | undefined;
      return this.invoiceRecords.filter(
        (invoice) =>
          matchesInvoiceWhere(invoice, where?.invoice) &&
          (
            [
              BankSlipStatus.ISSUE_FAILED,
              BankSlipStatus.CANCELLATION_FAILED,
              BankSlipStatus.UNKNOWN,
            ] as BankSlipStatus[]
          ).includes(invoice.bankSlip?.status as BankSlipStatus),
      ).length;
    },
    countCalls: [] as Record<string, unknown>[],
  };

  $queryRaw = async (sql: { strings: string[]; values: unknown[] }) => {
    const limitIndex = sql.strings.findIndex((part) => part.endsWith("LIMIT "));
    const offsetIndex = sql.strings.findIndex((part) => part.endsWith("OFFSET "));
    const limit =
      limitIndex >= 0 && typeof sql.values[limitIndex] === "number"
        ? sql.values[limitIndex]
        : this.invoiceRecords.length;
    const offset =
      offsetIndex >= 0 && typeof sql.values[offsetIndex] === "number"
        ? sql.values[offsetIndex]
        : 0;
    const rows = (this.applyQuery
      ? this.invoiceRecords.filter((record) => matchesOperationalSql(record, sql))
      : this.invoiceRecords)
      .sort(sortOperationallyForSpec)
      .slice(offset, offset + limit)
      .map((record) => ({ id: record.id }));
    return rows;
  };

  private filterInvoices(where: unknown) {
    if (!this.applyQuery) {
      return this.invoiceRecords;
    }
    return this.invoiceRecords.filter((record) => matchesInvoiceWhere(record, where));
  }
}

function matchesInvoiceWhere(
  invoice: ReturnType<typeof invoiceRecord>,
  where: unknown,
): boolean {
  if (!where || typeof where !== "object") {
    return true;
  }
  const input = where as Record<string, unknown>;
  const and = input.AND;
  if (Array.isArray(and) && and.some((item) => !matchesInvoiceWhere(invoice, item))) {
    return false;
  }
  const id = input.id as { in?: string[] } | undefined;
  if (id?.in && !id.in.includes(invoice.id)) {
    return false;
  }
  const not = input.NOT;
  if (not && matchesInvoiceWhere(invoice, not)) {
    return false;
  }
  if (input.status && invoice.status !== input.status) {
    return false;
  }
  const dueDate = input.dueDate as
    | { gte?: Date; lte?: Date; lt?: Date }
    | undefined;
  if (dueDate?.gte && invoice.dueDate < dueDate.gte) {
    return false;
  }
  if (dueDate?.lte && invoice.dueDate > dueDate.lte) {
    return false;
  }
  if (dueDate?.lt && invoice.dueDate >= dueDate.lt) {
    return false;
  }
  const enrollment = input.enrollment as
    | { academicYearId?: string; institutionId?: string }
    | undefined;
  if (
    enrollment?.academicYearId &&
    invoice.enrollment.academicYear.id !== enrollment.academicYearId
  ) {
    return false;
  }
  if (
    enrollment?.institutionId &&
    invoice.enrollment.institution.id !== enrollment.institutionId
  ) {
    return false;
  }
  const bankSlip = input.bankSlip as
    | { is?: { paidAt?: { gte?: Date; lt?: Date }; status?: BankSlipStatus } }
    | undefined;
  if (bankSlip?.is?.status && invoice.bankSlip?.status !== bankSlip.is.status) {
    return false;
  }
  const paidAt = bankSlip?.is?.paidAt;
  if (paidAt?.gte && (!invoice.bankSlip?.paidAt || invoice.bankSlip.paidAt < paidAt.gte)) {
    return false;
  }
  if (paidAt?.lt && (!invoice.bankSlip?.paidAt || invoice.bankSlip.paidAt >= paidAt.lt)) {
    return false;
  }
  const or = input.OR;
  if (Array.isArray(or) && !or.some((item) => matchesInvoiceSearch(invoice, item))) {
    return false;
  }
  return true;
}

function matchesOperationalSql(
  invoice: ReturnType<typeof invoiceRecord>,
  sql: { strings: string[]; values: unknown[] },
) {
  for (let index = 0; index < sql.values.length; index += 1) {
    const before = sql.strings[index] ?? "";
    const after = sql.strings[index + 1] ?? "";
    const value = sql.values[index];
    if (before.includes("ORDER BY")) {
      break;
    }
    if (before.includes("i.status = ") && after.startsWith('::"InvoiceStatus"')) {
      if (invoice.status !== value) {
        return false;
      }
    }
    if (before.includes("e.academic_year_id =") && invoice.enrollment.academicYear.id !== value) {
      return false;
    }
    if (before.includes("e.institution_id =") && invoice.enrollment.institution.id !== value) {
      return false;
    }
    if (before.includes("i.due_date >=") && typeof value === "string") {
      if (dateOnly(invoice.dueDate) < value) {
        return false;
      }
    }
    if (before.includes("i.due_date <=") && typeof value === "string") {
      if (dateOnly(invoice.dueDate) > value) {
        return false;
      }
    }
    if (before.includes("i.due_date <") && typeof value === "string") {
      if (!(invoice.status === InvoiceStatus.OPEN && dateOnly(invoice.dueDate) < value)) {
        return false;
      }
    }
    if (before.includes("p.normalized_name LIKE") && typeof value === "string") {
      const expected = value.replace(/%/g, "");
      const cpfValue = sql.values[index + 1];
      const cpfExpected = typeof cpfValue === "string" ? cpfValue.replace(/%/g, "") : "";
      if (
        !invoice.student.person.normalizedName.includes(expected) &&
        !(cpfExpected && invoice.student.person.cpf.includes(cpfExpected))
      ) {
        return false;
      }
    }
    if (before.includes("bs.status = ") && after.startsWith('::"BankSlipStatus"')) {
      if (invoice.bankSlip?.status !== value) {
        return false;
      }
    }
    if (before.includes("bs.paid_at >=") && typeof value === "string") {
      if (!invoice.bankSlip?.paidAt || dateOnly(invoice.bankSlip.paidAt) < value) {
        return false;
      }
    }
    if (before.includes("bs.paid_at <") && typeof value === "string") {
      if (!invoice.bankSlip?.paidAt || dateOnly(invoice.bankSlip.paidAt) > value) {
        return false;
      }
    }
  }
  return true;
}

function sortOperationallyForSpec(
  left: ReturnType<typeof invoiceRecord>,
  right: ReturnType<typeof invoiceRecord>,
) {
  const rankDiff = operationalRankForSpec(left) - operationalRankForSpec(right);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  if (left.status === InvoiceStatus.PAID && right.status === InvoiceStatus.PAID) {
    return (
      (right.bankSlip?.paidAt ?? right.updatedAt).getTime() -
      (left.bankSlip?.paidAt ?? left.updatedAt).getTime()
    );
  }
  const dueDiff = dateOnly(left.dueDate).localeCompare(dateOnly(right.dueDate));
  if (dueDiff !== 0) {
    return dueDiff;
  }
  return right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id);
}

function operationalRankForSpec(invoice: ReturnType<typeof invoiceRecord>) {
  const today = "2026-07-15";
  if (invoice.status === InvoiceStatus.OPEN && dateOnly(invoice.dueDate) < today) {
    return 1;
  }
  if (invoice.status === InvoiceStatus.OPEN) {
    return 2;
  }
  if (invoice.status === InvoiceStatus.PAID) {
    return 3;
  }
  if (invoice.status === InvoiceStatus.CANCELLED) {
    return 4;
  }
  return 5;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function matchesInvoiceSearch(
  invoice: ReturnType<typeof invoiceRecord>,
  where: unknown,
): boolean {
  const serialized = JSON.stringify(where);
  const normalizedName = invoice.student.person.normalizedName;
  const cpf = invoice.student.person.cpf;
  const nameContains = serialized.match(/"normalizedName":\{"contains":"([^"]+)"/)?.[1];
  const cpfContains = serialized.match(/"cpf":\{"contains":"([^"]+)"/)?.[1];
  return Boolean(
    (nameContains && normalizedName.includes(nameContains)) ||
      (cpfContains && cpf.includes(cpfContains)),
  );
}

function invoiceRecord({
  id = "invoice-1",
  amountCents = 12050,
  bankSlip = undefined,
  bankSlipStatus = BankSlipStatus.ISSUED,
  dueDate = "2026-07-20",
  academicYearId = "academic-year-1",
  institutionId = "institution-1",
  searchName = "Academico Teste",
  status = InvoiceStatus.OPEN,
}: {
  id?: string;
  amountCents?: number;
  bankSlip?: ReturnType<typeof bankSlipRecord> | null;
  bankSlipStatus?: BankSlipStatus;
  dueDate?: string;
  academicYearId?: string;
  institutionId?: string;
  searchName?: string;
  status?: InvoiceStatus;
} = {}) {
  const now = new Date("2026-07-15T12:00:00.000Z");
  return {
    id,
    studentId: "student-1",
    enrollmentId: "enrollment-1",
    amountCents,
    dueDate: new Date(`${dueDate}T00:00:00.000Z`),
    status,
    description: null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationNote: null,
    createdAt: now,
    updatedAt: now,
    student: {
      id: "student-1",
      status: StudentStatus.ACTIVE,
      person: {
        id: "person-1",
        fullName: searchName,
        normalizedName: searchName
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .toLowerCase(),
        cpf: "12345678909",
      },
      boardMemberships: [],
    },
    enrollment: {
      id: "enrollment-1",
      status: EnrollmentStatus.ACTIVE,
      course: "Musculacao",
      grade: "A",
      academicYear: {
        id: academicYearId,
        year: 2026,
        isCurrent: true,
        status: AcademicYearStatus.ACTIVE,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      institution: {
        id: institutionId,
        name: "Instituicao",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      shift: {
        id: "shift-1",
        name: "Manha",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    },
    createdBy: { id: "user-1", name: "Secretaria", email: "secretaria@test" },
    cancelledBy: null,
    bankSlip:
      bankSlip === undefined
        ? bankSlipRecord({ invoiceId: id, status: bankSlipStatus, now })
        : bankSlip,
  };
}

function bankSlipRecord({
  invoiceId,
  paidAmountCents = 12050,
  paidAt,
  status,
  now = new Date("2026-07-15T12:00:00.000Z"),
}: {
  invoiceId: string;
  paidAmountCents?: number | null;
  paidAt?: Date | null;
  status: BankSlipStatus;
  now?: Date;
}) {
  return {
    id: `bank-slip-${invoiceId}`,
    status,
    nossoNumero: "251006142",
    issuedAt: now,
    paidAmountCents,
    paidAt: paidAt === undefined ? (status === BankSlipStatus.PAID ? now : null) : paidAt,
    cancelledAt: status === BankSlipStatus.CANCELLED ? now : null,
    lastCheckedAt: now,
  };
}

await testListInvoicesIncludesBankSlipSummaryWithoutNPlusOne();
await testStudentInvoicesReuseAggregatedBankSlipSummary();
await testAdministratorListsInvoicesWithoutInstitutionProfile();
await testListInvoicesSummaryUsesAllFilteredInvoices();
await testListInvoicesFiltersPaidInvoicesByPaymentDate();
await testListInvoicesUsesOperationalOrderBeforePagination();

function hasNestedPaidAtFilter(value: unknown) {
  const serialized = JSON.stringify(value);
  return (
    serialized.includes("paidAt") &&
    serialized.includes("2026-07-01") &&
    serialized.includes("2026-08-01")
  );
}

function hasNestedValue(value: unknown, expected: string) {
  return JSON.stringify(value).includes(expected);
}
