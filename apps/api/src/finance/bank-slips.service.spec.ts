import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BankSlipEnvironment,
  BankSlipProvider,
  BankSlipStatus,
  EnrollmentStatus,
  InvoiceCancellationReason,
  InvoiceStatus,
  StudentHistoryEventType,
} from "@prisma/client";
import { BankSlipsService } from "./bank-slips.service.js";
import { SicrediClientError } from "./sicredi-client.js";
import type { SicrediConfig } from "./sicredi-config.js";

const config: SicrediConfig = {
  environment: "sandbox",
  authUrl: "https://sicredi.test/auth",
  baseUrl: "https://sicredi.test/api",
  apiKey: "secret-api-key",
  username: "user",
  password: "secret-password",
  cooperativa: "6789",
  posto: "03",
  codigoBeneficiario: "12345",
  timeoutMs: 10,
  requirePayerAddress: true,
};

async function testIssueBankSlipSuccess() {
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.issueForInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(result.seuNumero, "A000000001");
  assert.equal(result.nossoNumero, "251006142");
  assert.equal(sicredi.issueCalls.length, 1);
  assert.equal(sicredi.issueCalls[0]?.seuNumero, "A000000001");
  assert.equal((sicredi.issueCalls[0] as Record<string, unknown>).nossoNumero, undefined);
  assert.equal(prisma.bankSlips[0]?.originalAmountCents, 12050);
  assert.equal(prisma.historyEvents[0]?.eventType, StudentHistoryEventType.BANK_SLIP_ISSUED);
  assert.equal(
    prisma.auditLogs.some(
      (log) => log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUED,
    ),
    true,
  );
  const auditText = JSON.stringify(prisma.auditLogs);
  assert.doesNotMatch(auditText, /12345678909/);
  assert.doesNotMatch(auditText, /secret-api-key|secret-password|access_token/);
}

async function testIssueUncertainMarksUnknown() {
  const prisma = new FakePrisma();
  const sicredi = new FakeSicrediClient();
  sicredi.issueError = new SicrediClientError({
    operation: "issueBankSlip",
    message: "Sicredi request timed out",
    code: "TIMEOUT",
    transient: true,
    uncertain: true,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof ConflictException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.UNKNOWN);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "TIMEOUT");
  assert.equal(
    prisma.auditLogs.some(
      (log) => log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED,
    ),
    true,
  );
  assert.equal(
    prisma.historyEvents.some(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_ISSUED,
    ),
    false,
  );
}

async function testStalePendingIssueBecomesUnknown() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.PENDING_ISSUE,
    nossoNumero: null,
    linhaDigitavel: null,
    codigoBarras: null,
    issuedAt: null,
    updatedAt: new Date(Date.now() - 20 * 60 * 1000),
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof ConflictException,
  );
  assert.equal(sicredi.issueCalls.length, 0);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.UNKNOWN);
  assert.equal(prisma.bankSlips[0]?.providerErrorCode, "PENDING_ISSUE_STALE");
  assert.equal(
    prisma.auditLogs.some(
      (log) => log.eventType === AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED,
    ),
    true,
  );
}

async function testFreshPendingIssueStaysPending() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({
    status: BankSlipStatus.PENDING_ISSUE,
    nossoNumero: null,
    linhaDigitavel: null,
    codigoBarras: null,
    issuedAt: null,
    updatedAt: new Date(),
  });
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof ConflictException,
  );
  assert.equal(sicredi.issueCalls.length, 0);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.PENDING_ISSUE);
  assert.equal(prisma.auditLogs.length, 0);
}

async function testConcurrentSeuNumeroGeneration() {
  const prisma = new FakePrisma();
  prisma.addInvoice("invoice-2");
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const [first, second] = await Promise.all([
    service.issueForInvoice("invoice-1", "user-1"),
    service.issueForInvoice("invoice-2", "user-1"),
  ]);

  assert.notEqual(first.seuNumero, second.seuNumero);
  assert.deepEqual(
    prisma.bankSlips.map((bankSlip) => bankSlip.seuNumero),
    ["A000000001", "A000000002"],
  );
}

async function testSyncPaidMarksInvoicePaid() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.PAID);
  assert.equal(result.paidAmountCents, 12050);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.PAID);
  assert.equal(
    prisma.historyEvents.some(
      (event) =>
        event.eventType === StudentHistoryEventType.BANK_SLIP_PAYMENT_CONFIRMED,
    ),
    true,
  );
}

async function testSyncPaidByDay() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncPaidByDay("2099-08-11", "user-1");

  assert.equal(result.paymentsConfirmed, 1);
  assert.equal(result.bankSlipsFound, 1);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.PAID);
}

async function testSyncUnknownStatusPreservesCurrentState() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "EM CARTORIO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(result.providerStatus, "EM CARTORIO");
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
}

async function testSyncRejectedStatusPreservesCurrentState() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "REJEITADO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.ISSUED);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testSyncPaidDoesNotRegress() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip({ status: BankSlipStatus.PAID });
  (prisma.invoiceRecord as Record<string, unknown>).status = InvoiceStatus.PAID;
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "EM CARTEIRA";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.syncByInvoice("invoice-1", "user-1");

  assert.equal(result.status, BankSlipStatus.PAID);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.PAID);
}

async function testSync404DoesNotAlterState() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.getError = new SicrediClientError({
    operation: "getBankSlip",
    message: "Nosso Numero nao encontrado",
    statusCode: 404,
    code: "NAO_ENCONTRADO",
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () => service.syncByInvoice("invoice-1", "user-1"),
    (error) => error instanceof NotFoundException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testCancellationRequestStaysPending() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const result = await service.requestCancellation("invoice-1", "user-1", {
    reason: InvoiceCancellationReason.OTHER,
    note: "Pedido manual",
  });

  assert.equal(result.status, BankSlipStatus.PENDING_CANCELLATION);
  assert.equal(result.providerStatus, "MOVIMENTO_ENVIADO");
  assert.ok(prisma.bankSlips[0]?.cancellationRequestedAt);
  assert.equal(prisma.bankSlips[0]?.cancellationRequestedByUserId, "user-1");
  assert.equal(prisma.bankSlips[0]?.cancellationReason, InvoiceCancellationReason.OTHER);
  assert.equal(prisma.bankSlips[0]?.cancellationNote, "Pedido manual");
  assert.equal(
    prisma.historyEvents.some(
      (event) =>
        event.eventType === StudentHistoryEventType.BANK_SLIP_CANCELLATION_REQUESTED,
    ),
    true,
  );
}

async function testCancellationReasonRequired() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(() =>
    service.requestCancellation("invoice-1", "user-1", {} as never),
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testCancellationTimeoutStaysPending() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.cancelError = new SicrediClientError({
    operation: "requestCancellation",
    message: "Gateway timeout",
    statusCode: 504,
    code: "504",
    transient: true,
    uncertain: true,
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () =>
      service.requestCancellation("invoice-1", "user-1", {
        reason: InvoiceCancellationReason.OTHER,
      }),
    (error) => error instanceof ServiceUnavailableException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.PENDING_CANCELLATION);
  assert.notEqual(prisma.bankSlips[0]?.status, BankSlipStatus.CANCELLATION_FAILED);
}

async function testCancellationAlreadyCancelledConfirmsBySync() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.cancelError = new SicrediClientError({
    operation: "requestCancellation",
    message: "Boleto ja baixado",
    statusCode: 422,
    code: "BOLETO_BAIXADO",
  });
  sicredi.nextStatus = "BAIXADO POR SOLICITACAO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () =>
      service.requestCancellation("invoice-1", "user-1", {
        reason: InvoiceCancellationReason.OTHER,
      }),
    (error) => error instanceof ConflictException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.CANCELLED);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.CANCELLED);
}

async function testCancellationNotFoundPreservesPreviousStatus() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.cancelError = new SicrediClientError({
    operation: "requestCancellation",
    message: "Nosso Numero nao encontrado",
    statusCode: 404,
    code: "NAO_ENCONTRADO",
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(
    () =>
      service.requestCancellation("invoice-1", "user-1", {
        reason: InvoiceCancellationReason.OTHER,
      }),
    (error) => error instanceof NotFoundException,
  );
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.OPEN);
}

async function testCancellationConfirmedBySyncCancelsInvoice() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.nextStatus = "BAIXADO POR SOLICITACAO";
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await service.requestCancellation("invoice-1", "user-1", {
    reason: InvoiceCancellationReason.OTHER,
    note: "Pedido manual",
  });
  prisma.auditLogs.unshift({
    eventType: AdministrativeAuditEventType.BANK_SLIP_CANCELLATION_REQUESTED,
    userId: "wrong-user",
    metadata: { reason: InvoiceCancellationReason.DUPLICATE },
  });
  const result = await service.syncByInvoice("invoice-1", "user-2");

  assert.equal(result.status, BankSlipStatus.CANCELLED);
  assert.equal(prisma.invoiceRecord.status, InvoiceStatus.CANCELLED);
  assert.equal(
    (prisma.invoiceRecord as Record<string, unknown>).cancellationReason,
    InvoiceCancellationReason.OTHER,
  );
  assert.equal((prisma.invoiceRecord as Record<string, unknown>).cancelledByUserId, "user-1");
  assert.equal((prisma.invoiceRecord as Record<string, unknown>).cancellationNote, "Pedido manual");
  assert.equal(prisma.auditFindFirstCalls, 0);
  assert.equal(
    prisma.historyEvents.some(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_CANCELLED,
    ),
    true,
  );

  const repeated = await service.syncByInvoice("invoice-1", "user-2");
  assert.equal(repeated.status, BankSlipStatus.CANCELLED);
  assert.equal(
    prisma.historyEvents.filter(
      (event) => event.eventType === StudentHistoryEventType.BANK_SLIP_CANCELLED,
    ).length,
    1,
  );
}

async function testPdfUsesStoredLinhaDigitavel() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  const pdf = await service.getPdf("invoice-1");

  assert.equal(pdf.contentType, "application/pdf");
  assert.equal(pdf.bytes.toString(), "%PDF-1.4");
  assert.equal(sicredi.pdfLinhaDigitavel, "74891125110061420512803153351030188640000009990");
}

async function testPdfErrorsAreMappedSafely() {
  const prisma = new FakePrisma();
  prisma.seedIssuedBankSlip();
  const sicredi = new FakeSicrediClient();
  sicredi.pdfError = new SicrediClientError({
    operation: "getPdf",
    message: "Forbidden secret-api-key",
    statusCode: 403,
    code: "FORBIDDEN",
  });
  const service = new BankSlipsService(prisma as never, sicredi as never, config);

  await assert.rejects(() => service.getPdf("invoice-1"), /Operacao nao autorizada/);
  assert.equal(prisma.bankSlips[0]?.status, BankSlipStatus.ISSUED);
}

async function testPayerManualLimits() {
  const prisma = new FakePrisma();
  prisma.invoiceRecord.student.person.fullName = "A".repeat(41);
  const service = new BankSlipsService(prisma as never, new FakeSicrediClient() as never, config);

  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );

  prisma.invoiceRecord.student.person.fullName = "Aluno Teste";
  prisma.invoiceRecord.student.person.addressCity = "C".repeat(26);
  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );

  prisma.invoiceRecord.student.person.addressCity = "Curitiba";
  prisma.invoiceRecord.student.person.addressState = "PAR";
  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );

  prisma.invoiceRecord.student.person.addressState = "PR";
  prisma.invoiceRecord.student.person.addressZipCode = "123";
  await assert.rejects(
    () => service.issueForInvoice("invoice-1", "user-1"),
    (error) => error instanceof BadRequestException,
  );
}

class FakeSicrediClient {
  issueCalls: Array<Record<string, unknown>> = [];
  issueError?: SicrediClientError;
  getError?: SicrediClientError;
  cancelError?: SicrediClientError;
  pdfError?: SicrediClientError;
  pdfLinhaDigitavel?: string;
  nextStatus = "LIQUIDADO";

  async issueBankSlip(input: Record<string, unknown>) {
    this.issueCalls.push(input);
    if (this.issueError) {
      throw this.issueError;
    }
    return {
      nossoNumero: "251006142",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      cooperativa: "6789",
      posto: "03",
    };
  }

  async getBankSlip() {
    if (this.getError) {
      throw this.getError;
    }
    return {
      nossoNumero: "251006142",
      seuNumero: "A000000001",
      situacao: this.nextStatus,
      valorNominal: "120.50",
      dataVencimento: "2099-08-10",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      dadosLiquidacao: { data: "2099-08-11", valor: "120.50" },
    };
  }

  async *iteratePaidBankSlipsByDay() {
    yield {
      items: [
        {
          nossoNumero: "251006142",
          seuNumero: "A000000001",
          dataPagamento: "2099-08-11",
          valor: "120.50",
          valorLiquidado: "120.50",
          tipoLiquidacao: "LIQUIDADO",
        },
      ],
      hasNext: false,
    };
  }

  async requestCancellation() {
    if (this.cancelError) {
      throw this.cancelError;
    }
    return {
      transactionId: "tx-1",
      dataMovimento: "2099-08-11",
      codigoBeneficiario: "12345",
      nossoNumero: "251006142",
      cooperativa: "6789",
      posto: "03",
      statusComando: "MOVIMENTO_ENVIADO",
    };
  }

  async getPdf(linhaDigitavel: string) {
    if (this.pdfError) {
      throw this.pdfError;
    }
    this.pdfLinhaDigitavel = linhaDigitavel;
    return {
      bytes: Buffer.from("%PDF-1.4"),
      contentType: "application/pdf",
      sizeBytes: 8,
      filename: "boleto-test.pdf",
    };
  }
}

class FakePrisma {
  invoices = new Map([["invoice-1", createInvoice("invoice-1")]]);
  bankSlips: Array<Record<string, unknown>> = [];
  historyEvents: Array<Record<string, unknown>> = [];
  auditLogs: Array<Record<string, unknown>> = [];
  auditFindFirstCalls = 0;
  private bankSlipIdSequence = 0;
  private transactionQueue = Promise.resolve();

  get invoiceRecord() {
    const invoice = this.invoices.get("invoice-1");
    assert.ok(invoice);
    return invoice;
  }

  studentHistoryEvent = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.historyEvents.push(data);
      return data;
    },
  };

  administrativeAuditLog = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.auditLogs.push(data);
      return data;
    },
    findFirst: async () => {
      this.auditFindFirstCalls += 1;
      return null;
    },
  };

  invoiceDelegate = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.invoiceWithBankSlip(where.id),
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const invoice = this.invoices.get(where.id);
      assert.ok(invoice);
      Object.assign(invoice, data);
      return this.invoiceWithBankSlip(where.id);
    },
  };

  bankSlip = {
    findUnique: async ({ where }: { where: { id?: string; invoiceId?: string } }) =>
      where.invoiceId
        ? this.bankSlipWithInvoiceId(where.invoiceId)
        : this.bankSlipWithInvoice(String(where.id)),
    findFirst: async (args?: { select?: { seuNumero?: boolean } }) => {
      const record = this.bankSlips.at(-1);
      if (!record) {
        return null;
      }
      return args?.select?.seuNumero ? { seuNumero: record.seuNumero } : this.bankSlipWithInvoice(String(record.id));
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      this.bankSlipIdSequence += 1;
      const record = {
        id: `bank-slip-${this.bankSlipIdSequence}`,
        provider: BankSlipProvider.SICREDI,
        environment: BankSlipEnvironment.SANDBOX,
        createdAt: new Date(),
        updatedAt: new Date(),
        nossoNumero: null,
        linhaDigitavel: null,
        codigoBarras: null,
        paidAmountCents: null,
        issuedAt: null,
        paidAt: null,
        cancelledAt: null,
        cancellationRequestedAt: null,
        cancellationRequestedByUserId: null,
        cancellationReason: null,
        cancellationNote: null,
        lastCheckedAt: null,
        providerStatus: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        ...data,
      };
      this.bankSlips.push(record);
      return record;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const record = this.bankSlips.find((item) => item.id === where.id);
      assert.ok(record);
      Object.assign(record, data, { updatedAt: new Date() });
      return this.bankSlipWithInvoice(where.id);
    },
  };

  invoice = this.invoiceDelegate;

  async $transaction<T>(callback: (tx: this) => Promise<T>) {
    const previous = this.transactionQueue;
    let release: () => void = () => undefined;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback(this);
    } finally {
      release();
    }
  }

  async $queryRaw() {
    return [{ id: "locked" }];
  }

  seedIssuedBankSlip(overrides: Record<string, unknown> = {}) {
    this.bankSlips.push({
      id: "bank-slip-1",
      invoiceId: "invoice-1",
      provider: BankSlipProvider.SICREDI,
      environment: BankSlipEnvironment.SANDBOX,
      status: BankSlipStatus.ISSUED,
      documentSpecies: "RECIBO",
      nossoNumero: "251006142",
      seuNumero: "A000000001",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      originalAmountCents: 12050,
      paidAmountCents: null,
      issuedAt: new Date(),
      paidAt: null,
      cancelledAt: null,
      cancellationRequestedAt: null,
      cancellationRequestedByUserId: null,
      cancellationReason: null,
      cancellationNote: null,
      lastCheckedAt: null,
      providerStatus: "ISSUED",
      providerErrorCode: null,
      providerErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    (this.invoiceRecord as Record<string, unknown>).bankSlip = this.bankSlips[0];
  }

  addInvoice(id: string) {
    this.invoices.set(id, createInvoice(id));
  }

  private invoiceWithBankSlip(id: string) {
    const invoice = this.invoices.get(id);
    assert.ok(invoice);
    const bankSlip = this.bankSlips.find((item) => item.invoiceId === id) ?? null;
    return {
      ...invoice,
      bankSlip,
    };
  }

  private bankSlipWithInvoice(id: string) {
    const record = this.bankSlips.find((item) => item.id === id);
    return record ? { ...record, invoice: this.invoiceWithBankSlip(String(record.invoiceId)) } : null;
  }

  private bankSlipWithInvoiceId(invoiceId: string) {
    const record = this.bankSlips.find((item) => item.invoiceId === invoiceId);
    return record ? { ...record, invoice: this.invoiceWithBankSlip(invoiceId) } : null;
  }
}

function createInvoice(id: string) {
  return {
    id,
    studentId: "student-1",
    enrollmentId: "enrollment-1",
    amountCents: 12050,
    dueDate: new Date("2099-08-10T00:00:00.000Z"),
    status: InvoiceStatus.OPEN,
    enrollment: { id: "enrollment-1", status: EnrollmentStatus.ACTIVE },
    student: {
      id: "student-1",
      person: {
        id: "person-1",
        fullName: "Aluno Teste",
        cpf: "12345678909",
        addressStreet: "Rua Teste",
        addressCity: "Curitiba",
        addressZipCode: "80000-000",
        addressState: "PR",
        phone: null,
        email: null,
      },
    },
    bankSlip: null,
  };
}

await testIssueBankSlipSuccess();
await testIssueUncertainMarksUnknown();
await testStalePendingIssueBecomesUnknown();
await testFreshPendingIssueStaysPending();
await testConcurrentSeuNumeroGeneration();
await testSyncPaidMarksInvoicePaid();
await testSyncPaidByDay();
await testSyncUnknownStatusPreservesCurrentState();
await testSyncRejectedStatusPreservesCurrentState();
await testSyncPaidDoesNotRegress();
await testSync404DoesNotAlterState();
await testCancellationRequestStaysPending();
await testCancellationReasonRequired();
await testCancellationTimeoutStaysPending();
await testCancellationAlreadyCancelledConfirmsBySync();
await testCancellationNotFoundPreservesPreviousStatus();
await testCancellationConfirmedBySyncCancelsInvoice();
await testPdfUsesStoredLinhaDigitavel();
await testPdfErrorsAreMappedSafely();
await testPayerManualLimits();
