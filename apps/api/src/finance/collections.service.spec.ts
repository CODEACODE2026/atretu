import assert from "node:assert/strict";
import {
  BankSlipProvider,
  BankSlipStatus,
  CollectionActionSource,
  CollectionActionType,
  CollectionChannel,
  InvoiceStatus,
  RoleCode,
  UserStatus,
} from "@prisma/client";
import type { AuthUser } from "../users/users.service.js";
import { CollectionsService } from "./collections.service.js";
import {
  CollectionAgingBucket,
  CollectionOperationalStatus,
  CollectionPriority,
} from "./dto/collections.dto.js";

const NOW = new Date("2026-07-21T12:00:00.000Z");
const USER: AuthUser = {
  id: "user-1",
  name: "Secretaria",
  email: "secretaria@test",
  status: UserStatus.ACTIVE,
  roles: [RoleCode.SECRETARIA],
};

async function testActiveQueueRulesAndNoNPlusOne() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "overdue", dueDate: "2026-07-01" }),
    invoiceRecord({ id: "future", dueDate: "2026-07-22" }),
    invoiceRecord({ id: "paid", dueDate: "2026-07-01", status: InvoiceStatus.PAID }),
    invoiceRecord({
      id: "cancelled",
      dueDate: "2026-07-01",
      status: InvoiceStatus.CANCELLED,
    }),
  ]);
  const service = newService(prisma);

  const result = await service.listCases({}, { page: 1, limit: 10 }, USER);

  assert.deepEqual(result.data.map((item) => item.invoiceId), ["overdue"]);
  assert.equal(result.pagination.total, 1);
  assert.equal(prisma.invoice.findManyCalls.length, 1);
  assert.equal(prisma.collectionAction.findManyCalls.length, 0);
  assert.equal(prisma.bankSlip.findUniqueCalls.length, 0);
}

async function testAgingBucketsAndSummary() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "d10", dueDate: "2026-07-11", amountCents: 10_000 }),
    invoiceRecord({ id: "d40", dueDate: "2026-06-11", amountCents: 20_000 }),
    invoiceRecord({ id: "d70", dueDate: "2026-05-12", amountCents: 30_000 }),
    invoiceRecord({ id: "d100", dueDate: "2026-04-12", amountCents: 40_000 }),
  ]);
  const service = newService(prisma);

  const summary = await service.getSummary({}, USER);
  const listed = await service.listCases(
    { agingBucket: CollectionAgingBucket.DAYS_61_90 },
    { page: 1, limit: 10 },
    USER,
  );

  assert.equal(summary.totalOverdueCents, 100_000);
  assert.equal(summary.invoiceCount, 4);
  assert.equal(summary.studentCount, 4);
  assert.equal(summary.averageOverdueAmountCents, 25_000);
  assert.deepEqual(summary.agingBuckets, {
    DAYS_1_30: 1,
    DAYS_31_60: 1,
    DAYS_61_90: 1,
    DAYS_90_PLUS: 1,
  });
  assert.deepEqual(listed.data.map((item) => item.invoiceId), ["d70"]);
}

async function testOperationalStatuses() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "no-action", dueDate: "2026-07-01" }),
    invoiceRecord({
      id: "contacted",
      dueDate: "2026-07-01",
      actions: [actionRecord({ actionType: CollectionActionType.CONTACT_MADE })],
    }),
    invoiceRecord({
      id: "promise-active",
      dueDate: "2026-07-01",
      actions: [
        actionRecord({
          actionType: CollectionActionType.PROMISE_TO_PAY,
          promiseDueDate: "2026-07-25",
        }),
      ],
    }),
    invoiceRecord({
      id: "promise-broken",
      dueDate: "2026-07-01",
      actions: [
        actionRecord({
          actionType: CollectionActionType.PROMISE_TO_PAY,
          promiseDueDate: "2026-07-10",
        }),
      ],
    }),
    invoiceRecord({
      id: "follow-up",
      dueDate: "2026-07-01",
      actions: [
        actionRecord({
          actionType: CollectionActionType.FOLLOW_UP_SCHEDULED,
          nextFollowUpAt: "2026-07-22T09:00:00.000Z",
        }),
      ],
    }),
    invoiceRecord({
      id: "no-contact",
      dueDate: "2026-07-01",
      actions: [actionRecord({ actionType: CollectionActionType.NO_CONTACT })],
    }),
    invoiceRecord({
      id: "partial",
      dueDate: "2026-07-01",
      amountCents: 20_000,
      bankSlip: bankSlipRecord({
        invoiceId: "partial",
        providerErrorCode: "PARTIAL_PAYMENT_REVIEW",
        paidAmountCents: 5_000,
      }),
    }),
  ]);
  const service = newService(prisma);

  const result = await service.listCases({}, { page: 1, limit: 20 }, USER);
  const byId = new Map(result.data.map((item) => [item.invoiceId, item]));

  assert.equal(
    byId.get("no-action")?.operationalStatus,
    CollectionOperationalStatus.OVERDUE_NO_ACTION,
  );
  assert.equal(
    byId.get("contacted")?.operationalStatus,
    CollectionOperationalStatus.CONTACTED,
  );
  assert.equal(
    byId.get("promise-active")?.operationalStatus,
    CollectionOperationalStatus.PROMISE_ACTIVE,
  );
  assert.equal(
    byId.get("promise-broken")?.operationalStatus,
    CollectionOperationalStatus.PROMISE_BROKEN,
  );
  assert.equal(
    byId.get("follow-up")?.operationalStatus,
    CollectionOperationalStatus.FOLLOW_UP_SCHEDULED,
  );
  assert.equal(
    byId.get("no-contact")?.operationalStatus,
    CollectionOperationalStatus.NO_CONTACT,
  );
  assert.equal(
    byId.get("partial")?.operationalStatus,
    CollectionOperationalStatus.PARTIAL_PAYMENT_REVIEW,
  );
  assert.equal(byId.get("partial")?.outstandingAmountCents, 15_000);
}

async function testPriorityRules() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "normal", dueDate: "2026-07-01", amountCents: 10_000 }),
    invoiceRecord({ id: "high", dueDate: "2026-05-01", amountCents: 10_000 }),
    invoiceRecord({ id: "critical", dueDate: "2026-07-01", amountCents: 100_000 }),
  ]);
  const service = newService(prisma);

  const result = await service.listCases({}, { page: 1, limit: 10 }, USER);
  const byId = new Map(result.data.map((item) => [item.invoiceId, item]));

  assert.equal(byId.get("normal")?.priority, CollectionPriority.NORMAL);
  assert.equal(byId.get("high")?.priority, CollectionPriority.HIGH);
  assert.equal(byId.get("critical")?.priority, CollectionPriority.CRITICAL);
}

async function testGetCaseAndListActionsForResolvedInvoices() {
  const prisma = new FakePrisma([
    invoiceRecord({
      id: "paid",
      dueDate: "2026-07-01",
      status: InvoiceStatus.PAID,
      actions: [actionRecord({ invoiceId: "paid" })],
    }),
    invoiceRecord({ id: "cancelled", status: InvoiceStatus.CANCELLED }),
  ]);
  const service = newService(prisma);

  const paid = await service.getCaseByInvoiceId("paid", USER);
  const actions = await service.listActions("paid", USER);
  const cancelled = await service.getCaseByInvoiceId("cancelled", USER);

  assert.equal(paid.operationalStatus, CollectionOperationalStatus.RESOLVED_BY_PAYMENT);
  assert.equal(cancelled.operationalStatus, CollectionOperationalStatus.CANCELLED);
  assert.equal(actions.data.length, 1);
}

async function testCreateActionValidatesAndAuditsWithoutFinancialMutation() {
  const invoice = invoiceRecord({ id: "invoice-1", dueDate: "2026-07-01" });
  const prisma = new FakePrisma([invoice]);
  const service = newService(prisma);

  const created = await service.createAction(
    "invoice-1",
    {
      actionType: CollectionActionType.PROMISE_TO_PAY,
      channel: CollectionChannel.WHATSAPP,
      note: "Responsavel prometeu pagar.",
      promisedAmountCents: 12_000,
      promiseDueDate: "2026-07-25",
    },
    USER,
  );

  assert.equal(created.invoiceId, "invoice-1");
  assert.equal(created.source, CollectionActionSource.MANUAL);
  assert.equal(created.createdByUser?.id, USER.id);
  assert.equal(prisma.actions.length, 1);
  assert.equal(prisma.auditLogs.length, 1);
  assert.equal(prisma.auditLogs[0]?.eventType, "COLLECTION_ACTION_CREATED");
  assert.equal(prisma.auditLogs[0]?.domain, "finance_collections");
  assert.equal(prisma.auditLogs[0]?.metadata.note, undefined);
  assert.equal(prisma.invoices.get("invoice-1")?.status, InvoiceStatus.OPEN);
  assert.equal(prisma.invoices.get("invoice-1")?.bankSlip?.status, BankSlipStatus.ISSUED);
}

async function testCreateActionRejectsInvalidBusinessRules() {
  const prisma = new FakePrisma([
    invoiceRecord({ id: "open", dueDate: "2026-07-01" }),
    invoiceRecord({ id: "paid", status: InvoiceStatus.PAID }),
    invoiceRecord({ id: "cancelled", status: InvoiceStatus.CANCELLED }),
  ]);
  const service = newService(prisma);

  await assert.rejects(
    () =>
      service.createAction(
        "open",
        {
          actionType: CollectionActionType.PROMISE_TO_PAY,
          note: "Sem data.",
        },
        USER,
      ),
    /Promessa de pagamento exige data/,
  );
  await assert.rejects(
    () =>
      service.createAction(
        "open",
        {
          actionType: CollectionActionType.FOLLOW_UP_SCHEDULED,
          note: "Sem retorno.",
        },
        USER,
      ),
    /Retorno agendado exige data/,
  );
  await assert.rejects(
    () =>
      service.createAction(
        "open",
        {
          actionType: CollectionActionType.INTERNAL_NOTE,
          note: "Valor invalido.",
          promisedAmountCents: 0,
        },
        USER,
      ),
    /Valor prometido deve ser positivo/,
  );
  await assert.rejects(
    () =>
      service.createAction(
        "open",
        {
          actionType: CollectionActionType.CONTACT_MADE,
          note: "Sem canal.",
        },
        USER,
      ),
    /Canal obrigatorio/,
  );
  await assert.rejects(
    () =>
      service.createAction(
        "open",
        {
          actionType: CollectionActionType.INTERNAL_NOTE,
          note: "Origem bloqueada.",
          source: CollectionActionSource.SYSTEM,
        },
        USER,
      ),
    /Somente a origem MANUAL/,
  );
  await assert.rejects(
    () =>
      service.createAction(
        "paid",
        {
          actionType: CollectionActionType.INTERNAL_NOTE,
          note: "Pago.",
        },
        USER,
      ),
    /fatura paga ou cancelada/,
  );
  await assert.rejects(
    () =>
      service.createAction(
        "cancelled",
        {
          actionType: CollectionActionType.INTERNAL_NOTE,
          note: "Cancelada.",
        },
        USER,
      ),
    /fatura paga ou cancelada/,
  );
}

async function testPermissionsFollowExistingRoles() {
  const prisma = new FakePrisma([invoiceRecord()]);
  const service = newService(prisma);

  await assert.rejects(
    () =>
      service.listCases({}, { page: 1, limit: 10 }, { ...USER, roles: [] }),
    /Acesso negado/,
  );
}

async function testFiltersAndFollowUps() {
  const prisma = new FakePrisma([
    invoiceRecord({
      id: "institution-match",
      institutionId: "institution-2",
      academicYearId: "academic-year-2",
      dueDate: "2026-07-01",
      actions: [
        actionRecord({
          invoiceId: "institution-match",
          actionType: CollectionActionType.FOLLOW_UP_SCHEDULED,
          nextFollowUpAt: "2026-07-21T14:00:00.000Z",
        }),
      ],
    }),
    invoiceRecord({ id: "other", institutionId: "institution-1" }),
  ]);
  const service = newService(prisma);

  const listed = await service.listCases(
    {
      institutionId: "institution-2",
      academicYearId: "academic-year-2",
      operationalStatus: CollectionOperationalStatus.FOLLOW_UP_SCHEDULED,
      followUpFrom: "2026-07-21",
      followUpTo: "2026-07-21",
    },
    { page: 1, limit: 10 },
    USER,
  );
  const followUps = await service.listFollowUps({}, USER);

  assert.deepEqual(listed.data.map((item) => item.invoiceId), ["institution-match"]);
  assert.deepEqual(followUps.data.map((item) => item.invoiceId), [
    "institution-match",
  ]);
}

class FakePrisma {
  invoices: Map<string, ReturnType<typeof invoiceRecord>>;
  actions: ReturnType<typeof actionRecord>[];
  auditLogs: Array<Record<string, any>> = [];
  bankSlip = {
    findUniqueCalls: [] as Record<string, unknown>[],
    findUnique: async (args: Record<string, unknown>) => {
      this.bankSlip.findUniqueCalls.push(args);
      return null;
    },
  };

  constructor(records: ReturnType<typeof invoiceRecord>[] = [invoiceRecord()]) {
    this.invoices = new Map(records.map((record) => [record.id, record]));
    this.actions = records.flatMap((record) => record.collectionActions);
  }

  invoice = {
    findManyCalls: [] as Record<string, unknown>[],
    findMany: async (args: { where?: Record<string, any> }) => {
      this.invoice.findManyCalls.push(args as Record<string, unknown>);
      return [...this.invoices.values()]
        .filter((invoice) => this.matchesInvoiceWhere(invoice, args.where ?? {}))
        .map((invoice) => this.withSortedActions(invoice));
    },
    findUnique: async (args: { where: { id: string }; include?: unknown; select?: unknown }) => {
      const invoice = this.invoices.get(args.where.id);
      if (!invoice) {
        return null;
      }
      if (args.select) {
        return { id: invoice.id };
      }
      return this.withSortedActions(invoice);
    },
  };

  collectionAction = {
    findManyCalls: [] as Record<string, unknown>[],
    findMany: async (args: { where: { invoiceId: string } }) => {
      this.collectionAction.findManyCalls.push(args);
      return this.actions
        .filter((action) => action.invoiceId === args.where.invoiceId)
        .sort(sortActions)
        .map((action) => this.withCreatedBy(action));
    },
    create: async ({
      data,
    }: {
      data: Record<string, unknown>;
      include?: unknown;
    }) => {
      const action = actionRecord({
        ...data,
        id: `collection-action-${this.actions.length + 1}`,
        createdBy: userPreview(),
      });
      this.actions.push(action);
      const invoice = this.invoices.get(String(action.invoiceId));
      assert.ok(invoice);
      invoice.collectionActions.push(action);
      return this.withCreatedBy(action);
    },
  };

  administrativeAuditLog = {
    create: async ({ data }: { data: Record<string, any> }) => {
      this.auditLogs.push(data);
      return data;
    },
  };

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    return callback(this);
  }

  private matchesInvoiceWhere(
    invoice: ReturnType<typeof invoiceRecord>,
    where: Record<string, any>,
  ) {
    if (where.status && invoice.status !== where.status) {
      return false;
    }
    if (where.studentId && invoice.studentId !== where.studentId) {
      return false;
    }
    if (where.dueDate) {
      const due = invoice.dueDate.getTime();
      if (where.dueDate.lt && !(due < where.dueDate.lt.getTime())) {
        return false;
      }
      if (where.dueDate.gte && !(due >= where.dueDate.gte.getTime())) {
        return false;
      }
      if (where.dueDate.lte && !(due <= where.dueDate.lte.getTime())) {
        return false;
      }
    }
    if (where.enrollment?.institutionId && invoice.enrollment.institutionId !== where.enrollment.institutionId) {
      return false;
    }
    if (where.enrollment?.academicYearId && invoice.enrollment.academicYearId !== where.enrollment.academicYearId) {
      return false;
    }
    if (where.collectionActions?.some?.actionType) {
      return invoice.collectionActions.some(
        (action) => action.actionType === where.collectionActions.some.actionType,
      );
    }
    if (where.collectionActions?.some?.nextFollowUpAt) {
      const filter = where.collectionActions.some.nextFollowUpAt;
      return invoice.collectionActions.some((action) => {
        if (!action.nextFollowUpAt) {
          return false;
        }
        const time = action.nextFollowUpAt.getTime();
        return (
          (!filter.gte || time >= filter.gte.getTime()) &&
          (!filter.lt || time < filter.lt.getTime())
        );
      });
    }
    return true;
  }

  private withSortedActions(invoice: ReturnType<typeof invoiceRecord>) {
    return {
      ...invoice,
      collectionActions: invoice.collectionActions
        .slice()
        .sort(sortActions)
        .map((action) => this.withCreatedBy(action)),
    };
  }

  private withCreatedBy(action: ReturnType<typeof actionRecord>) {
    return {
      ...action,
      createdBy: action.createdBy ?? userPreview(),
    };
  }
}

function newService(prisma: FakePrisma) {
  return new CollectionsService(prisma as never, () => NOW);
}

function invoiceRecord({
  id = "invoice-1",
  studentId,
  enrollmentId,
  institutionId = "institution-1",
  academicYearId = "academic-year-1",
  dueDate = "2026-07-01",
  status = InvoiceStatus.OPEN,
  amountCents = 12_000,
  actions = [],
  bankSlip,
}: {
  id?: string;
  studentId?: string;
  enrollmentId?: string;
  institutionId?: string;
  academicYearId?: string;
  dueDate?: string;
  status?: InvoiceStatus;
  amountCents?: number;
  actions?: ReturnType<typeof actionRecord>[];
  bankSlip?: ReturnType<typeof bankSlipRecord> | null;
} = {}) {
  const resolvedStudentId = studentId ?? `student-${id}`;
  const resolvedEnrollmentId = enrollmentId ?? `enrollment-${id}`;
  return {
    id,
    studentId: resolvedStudentId,
    enrollmentId: resolvedEnrollmentId,
    amountCents,
    dueDate: dateOnly(dueDate),
    status,
    description: null,
    idempotencyKey: `invoice-${id}`,
    cancelledAt: status === InvoiceStatus.CANCELLED ? NOW : null,
    cancellationReason: null,
    cancellationNote: null,
    createdByUserId: "user-1",
    cancelledByUserId: null,
    createdAt: NOW,
    updatedAt: NOW,
    student: {
      id: resolvedStudentId,
      personId: `person-${id}`,
      status: "ACTIVE",
      joinedAt: dateOnly("2026-01-01"),
      createdAt: NOW,
      updatedAt: NOW,
      person: {
        id: `person-${id}`,
        fullName: `Academico ${id}`,
        normalizedName: `academico ${id}`,
        cpf: "12345678909",
        rg: null,
        birthDate: dateOnly("2000-01-01"),
        phone: "11999999999",
        email: "aluno@test",
        addressStreet: "Rua",
        addressNumber: "1",
        addressNeighborhood: "Centro",
        addressCity: "Cidade",
        addressZipCode: null,
        addressState: null,
        addressComplement: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      guardian: {
        id: `guardian-${id}`,
        studentId: resolvedStudentId,
        fullName: "Responsavel",
        cpf: null,
        rg: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
    enrollment: {
      id: resolvedEnrollmentId,
      studentId: resolvedStudentId,
      academicYearId,
      institutionId,
      shiftId: "shift-1",
      course: "Curso",
      grade: "A",
      status: "ACTIVE",
      createdAt: NOW,
      updatedAt: NOW,
      institution: {
        id: institutionId,
        name: `Instituicao ${institutionId}`,
        normalizedName: "instituicao",
        status: "ACTIVE",
        createdAt: NOW,
        updatedAt: NOW,
      },
      academicYear: {
        id: academicYearId,
        year: 2026,
        isCurrent: true,
        status: "ACTIVE",
        archivedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
    bankSlip: bankSlip === undefined ? bankSlipRecord({ invoiceId: id }) : bankSlip,
    collectionActions: actions.map((action) => ({ ...action, invoiceId: id })),
  };
}

function actionRecord({
  id = "collection-action-1",
  invoiceId = "invoice-1",
  actionType = CollectionActionType.INTERNAL_NOTE,
  channel = null,
  source = CollectionActionSource.MANUAL,
  contactedName = null,
  contactedDocumentMasked = null,
  note = "Observacao de cobranca",
  promisedAmountCents = null,
  promiseDueDate = null,
  nextFollowUpAt = null,
  createdByUserId = "user-1",
  createdAt = "2026-07-20T12:00:00.000Z",
  createdBy = userPreview(),
}: Record<string, any> = {}) {
  return {
    id,
    invoiceId,
    actionType,
    channel,
    source,
    contactedName,
    contactedDocumentMasked,
    note,
    promisedAmountCents,
    promiseDueDate: promiseDueDate ? toDateOnly(promiseDueDate) : null,
    nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
    createdByUserId,
    createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
    createdBy,
  };
}

function bankSlipRecord({
  invoiceId = "invoice-1",
  status = BankSlipStatus.ISSUED,
  paidAmountCents = null,
  providerErrorCode = null,
}: {
  invoiceId?: string;
  status?: BankSlipStatus;
  paidAmountCents?: number | null;
  providerErrorCode?: string | null;
} = {}) {
  return {
    id: `bank-slip-${invoiceId}`,
    invoiceId,
    provider: BankSlipProvider.SICREDI,
    environment: "SANDBOX",
    status,
    documentSpecies: "RECIBO",
    nossoNumero: "251006142",
    seuNumero: "1234567890",
    txid: null,
    linhaDigitavel: null,
    codigoBarras: null,
    originalAmountCents: 12_000,
    paidAmountCents,
    issuedAt: NOW,
    paidAt: paidAmountCents ? NOW : null,
    cancellationRequestedAt: null,
    cancellationRequestedByUserId: null,
    cancellationReason: null,
    cancellationNote: null,
    cancelledAt: null,
    lastCheckedAt: NOW,
    providerStatus: null,
    providerErrorCode,
    providerErrorMessage: providerErrorCode ? "Pagamento parcial recebido" : null,
    pdfStorageKey: null,
    pdfStoredAt: NOW,
    pdfSha256: null,
    pdfSizeBytes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function userPreview() {
  return { id: "user-1", name: "Secretaria", email: "secretaria@test" };
}

function dateOnly(input: string) {
  return new Date(`${input}T00:00:00.000Z`);
}

function toDateOnly(input: string | Date) {
  if (input instanceof Date) {
    return input;
  }
  return dateOnly(input);
}

function sortActions(
  left: ReturnType<typeof actionRecord>,
  right: ReturnType<typeof actionRecord>,
) {
  return right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
}

await testActiveQueueRulesAndNoNPlusOne();
await testAgingBucketsAndSummary();
await testOperationalStatuses();
await testPriorityRules();
await testGetCaseAndListActionsForResolvedInvoices();
await testCreateActionValidatesAndAuditsWithoutFinancialMutation();
await testCreateActionRejectsInvalidBusinessRules();
await testPermissionsFollowExistingRoles();
await testFiltersAndFollowUps();
