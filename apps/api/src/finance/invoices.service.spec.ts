import assert from "node:assert/strict";
import {
  AcademicYearStatus,
  BankSlipStatus,
  EnrollmentStatus,
  InvoiceStatus,
  StudentStatus,
} from "@prisma/client";
import { InvoicesService } from "./invoices.service.js";

async function testListInvoicesIncludesBankSlipSummaryWithoutNPlusOne() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "invoice-without-slip", bankSlip: null }),
    invoiceRecord({ id: "invoice-issued", bankSlipStatus: BankSlipStatus.ISSUED }),
    invoiceRecord({ id: "invoice-paid", bankSlipStatus: BankSlipStatus.PAID }),
    invoiceRecord({ id: "invoice-cancelled", bankSlipStatus: BankSlipStatus.CANCELLED }),
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
    sort: "dueDate",
    order: "asc",
  } as never);

  assert.equal(prisma.invoice.findManyCalls.length, 1);
  assert.equal(prisma.invoice.countCalls.length, 1);
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
      "paidAt",
      "cancelledAt",
      "lastCheckedAt",
    ],
  );
  assert.equal(result.pagination.total, 5);
  assert.equal(result.pagination.totalPages, 3);
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

class FakePrisma {
  readonly invoiceRecords: ReturnType<typeof invoiceRecord>[];

  constructor(records = [invoiceRecord()]) {
    this.invoiceRecords = records;
    this.invoice.findManyCalls = [];
    this.invoice.countCalls = [];
  }

  invoice = {
    findMany: async (args: Record<string, unknown>) => {
      this.invoice.findManyCalls.push(args);
      return this.invoiceRecords;
    },
    count: async (args: Record<string, unknown>) => {
      this.invoice.countCalls.push(args);
      return this.invoiceRecords.length;
    },
  } as {
    findMany: ((args: Record<string, unknown>) => Promise<unknown[]>) & {
      findManyCalls?: unknown[];
    };
    count: ((args: Record<string, unknown>) => Promise<number>) & {
      countCalls?: unknown[];
    };
    findManyCalls: Record<string, unknown>[];
    countCalls: Record<string, unknown>[];
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
  };

}

function invoiceRecord({
  id = "invoice-1",
  bankSlip = undefined,
  bankSlipStatus = BankSlipStatus.ISSUED,
}: {
  id?: string;
  bankSlip?: ReturnType<typeof bankSlipRecord> | null;
  bankSlipStatus?: BankSlipStatus;
} = {}) {
  const now = new Date("2026-07-15T12:00:00.000Z");
  return {
    id,
    studentId: "student-1",
    enrollmentId: "enrollment-1",
    amountCents: 12050,
    dueDate: new Date("2026-07-20T00:00:00.000Z"),
    status: InvoiceStatus.OPEN,
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
        fullName: "Academico Teste",
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
        id: "academic-year-1",
        year: 2026,
        isCurrent: true,
        status: AcademicYearStatus.ACTIVE,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      institution: {
        id: "institution-1",
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
  status,
  now,
}: {
  invoiceId: string;
  status: BankSlipStatus;
  now: Date;
}) {
  return {
    id: `bank-slip-${invoiceId}`,
    status,
    nossoNumero: "251006142",
    issuedAt: now,
    paidAt: status === BankSlipStatus.PAID ? now : null,
    cancelledAt: status === BankSlipStatus.CANCELLED ? now : null,
    lastCheckedAt: now,
  };
}

await testListInvoicesIncludesBankSlipSummaryWithoutNPlusOne();
await testStudentInvoicesReuseAggregatedBankSlipSummary();
