import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BankSlipEnvironment,
  BankSlipProvider,
  BankSlipSyncRunItemStatus,
  BankSlipSyncRunStatus,
  BankSlipSyncRunType,
  BankSlipStatus,
  EnrollmentStatus,
  InvoiceCancellationReason,
  InvoiceStatus,
  Prisma,
  StudentHistoryEventType,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { isValidCpf, maskCpf } from "../students/cpf.js";
import { isInvoiceOverdue } from "./due-date.js";
import { formatCentsAsSicrediAmount, parseSicrediAmountToCents } from "./money.js";
import {
  SicrediClient,
  SicrediClientError,
  type SicrediBankSlipDetails,
  type SicrediIssueBankSlipInput,
  type SicrediIssueBankSlipResponse,
  type SicrediPaidBankSlip,
} from "./sicredi-client.js";
import type { SicrediConfig } from "./sicredi-config.js";
import { mapSicrediStatusToBankSlipStatus } from "./bank-slip-status.js";
import {
  toSicrediHttpException,
  translateSicrediClientError,
  type SicrediBusinessError,
} from "./sicredi-business-errors.js";
import type {
  ListBankSlipSyncRunItemsDto,
  ListBankSlipSyncRunsDto,
  RecoverIssuedBankSlipDto,
  RequestBankSlipCancellationDto,
} from "./dto/bank-slips.dto.js";
import { resolvePagination } from "../common/pagination.js";

export const SICREDI_CLIENT = Symbol("SICREDI_CLIENT");
export const SICREDI_CONFIG = Symbol("SICREDI_CONFIG");

type PrismaTx = Prisma.TransactionClient | PrismaService;
type SicrediClientPort = Pick<
  SicrediClient,
  "issueBankSlip" | "getBankSlip" | "iteratePaidBankSlipsByDay" | "requestCancellation" | "getPdf"
>;

type IssuePreparation = {
  kind: "issue";
  bankSlipId: string;
  invoiceId: string;
  studentId: string;
  amountCents: number;
  dueDate: string;
  seuNumero: string;
  documentSpecies: string;
  input: SicrediIssueBankSlipInput;
};

type IssuePreparationResult =
  | IssuePreparation
  | {
      kind: "already-issued";
      bankSlip: BankSlipWithRelations;
    };

type CancellationPreparation = {
  bankSlipId: string;
  invoiceId: string;
  studentId: string;
  nossoNumero: string;
  previousStatus: BankSlipStatus;
  reason: InvoiceCancellationReason;
};

const PENDING_ISSUE_STALE_MS = 15 * 60 * 1000;
const OPEN_ISSUED_SYNC_LOCK_ID = 7_811_004;

@Injectable()
export class BankSlipsService {
  private readonly logger = new Logger(BankSlipsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SICREDI_CLIENT) private readonly sicredi: SicrediClientPort,
    @Inject(SICREDI_CONFIG) private readonly sicrediConfig: SicrediConfig,
  ) {}

  async issueForInvoice(invoiceId: string, userId: string) {
    logIssueDiagnostic({
      etapa: "issue-start",
      invoiceId,
    });
    const prepared = await this.prepareIssue(invoiceId, userId);
    if (prepared.kind === "already-issued") {
      return this.toBankSlipSummary(prepared.bankSlip);
    }
    try {
      logIssueDiagnostic({
        etapa: "before-sicredi-client",
        invoiceId: prepared.invoiceId,
        bankSlipId: prepared.bankSlipId,
        seuNumero: prepared.seuNumero,
      });
      const response = await this.sicredi.issueBankSlip(prepared.input);
      const updated = await this.persistIssuedBankSlip(prepared, response, userId);
      return this.toBankSlipSummary(updated);
    } catch (error) {
      logIssueDiagnostic({
        etapa: "issue-catch",
        invoiceId: prepared.invoiceId,
        bankSlipId: prepared.bankSlipId,
        errorType: error instanceof Error ? error.name : typeof error,
        operation: error instanceof SicrediClientError ? error.operation : undefined,
        providerStatus: error instanceof SicrediClientError ? error.providerStatus : undefined,
        providerCode: error instanceof SicrediClientError ? error.providerCode : undefined,
        providerMessage:
          error instanceof SicrediClientError
            ? sanitizeIssueDiagnosticText(error.providerMessage ?? error.message)
            : undefined,
      });
      if (!(error instanceof SicrediClientError)) {
        throw error;
      }
      const translated = translateSicrediClientError(error, "issue");
      const status = error.uncertain
        ? BankSlipStatus.UNKNOWN
        : BankSlipStatus.ISSUE_FAILED;
      const failed = await this.prisma.$transaction(async (tx) => {
        const bankSlip = await tx.bankSlip.update({
          where: { id: prepared.bankSlipId },
          data: {
            status,
            providerErrorCode: this.truncate(error.code, 80),
            providerErrorMessage: this.truncate(error.message, 500),
            lastCheckedAt: new Date(),
          },
          include: this.bankSlipInclude(),
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED,
          recordId: bankSlip.id,
          userId,
          metadata: {
            invoiceId: prepared.invoiceId,
            studentId: prepared.studentId,
            bankSlipId: bankSlip.id,
            seuNumero: bankSlip.seuNumero,
            status: bankSlip.status,
            operation: error.operation,
            transient: error.transient,
            uncertain: error.uncertain,
            statusCode: error.statusCode ?? 0,
            code: error.code ?? "",
          },
        });
        return bankSlip;
      });
      if (error.uncertain) {
        throw new ConflictException({
          code: "BANK_SLIP_ISSUE_UNKNOWN",
          message: "Resultado da emissao do boleto ficou incerto; consulte o Sicredi antes de nova tentativa",
          bankSlip: this.toBankSlipSummary(failed),
        });
      }
      throw new BadRequestException({
        code: translated.code,
        message: translated.message,
        bankSlip: this.toBankSlipSummary(failed),
      });
    }
  }

  async recoverIssuedFromProviderResponse(
    invoiceId: string,
    userId: string,
    body: RecoverIssuedBankSlipDto,
  ) {
    const bankSlip = await this.getBankSlipByInvoice(invoiceId);
    if (body.bankSlipId && body.bankSlipId !== bankSlip.id) {
      throw new BadRequestException({
        code: "BANK_SLIP_RECOVERY_MISMATCH",
        message: "BankSlip informado nao pertence a fatura",
      });
    }
    if (body.seuNumero !== bankSlip.seuNumero) {
      throw new BadRequestException({
        code: "BANK_SLIP_RECOVERY_MISMATCH",
        message: "Seu Numero informado nao corresponde ao boleto local",
      });
    }
    if (bankSlip.status === BankSlipStatus.PAID || bankSlip.status === BankSlipStatus.PENDING_CANCELLATION) {
      throw new ConflictException({
        code: "BANK_SLIP_RECOVERY_BLOCKED",
        message: "Estado atual do boleto nao permite recuperacao manual da emissao",
      });
    }
    if (bankSlip.status === BankSlipStatus.ISSUED) {
      return this.toBankSlipSummary(bankSlip);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const recovered = await tx.bankSlip.update({
        where: { id: bankSlip.id },
        data: {
          status: BankSlipStatus.ISSUED,
          nossoNumero: body.nossoNumero,
          linhaDigitavel: body.linhaDigitavel,
          codigoBarras: body.codigoBarras,
          txid: this.optional(body.txid) ?? null,
          providerStatus: "ISSUED",
          providerErrorCode: null,
          providerErrorMessage: null,
          issuedAt: bankSlip.issuedAt ?? new Date(),
          lastCheckedAt: new Date(),
        },
        include: this.bankSlipInclude(),
      });
      await tx.studentHistoryEvent.create({
        data: {
          studentId: recovered.invoice.studentId,
          eventType: StudentHistoryEventType.BANK_SLIP_ISSUED,
          invoiceId: recovered.invoiceId,
          bankSlipId: recovered.id,
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BANK_SLIP_SYNCED,
        recordId: recovered.id,
        userId,
        metadata: {
          recovery: true,
          invoiceId: recovered.invoiceId,
          studentId: recovered.invoice.studentId,
          bankSlipId: recovered.id,
          seuNumero: recovered.seuNumero,
          nossoNumero: this.maskNossoNumero(recovered.nossoNumero),
          txidPresent: Boolean(recovered.txid),
          status: recovered.status,
        },
      });
      return recovered;
    });
    return this.toBankSlipSummary(updated);
  }

  private async persistIssuedBankSlip(
    prepared: IssuePreparation,
    response: SicrediIssueBankSlipResponse,
    userId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const bankSlip = await tx.bankSlip.update({
          where: { id: prepared.bankSlipId },
          data: {
            status: BankSlipStatus.ISSUED,
            nossoNumero: response.nossoNumero,
            linhaDigitavel: response.linhaDigitavel,
            codigoBarras: response.codigoBarras,
            txid: response.txid ?? null,
            providerStatus: "ISSUED",
            providerErrorCode: null,
            providerErrorMessage: null,
            issuedAt: new Date(),
            lastCheckedAt: new Date(),
          },
          include: this.bankSlipInclude(),
        });
        await tx.studentHistoryEvent.create({
          data: {
            studentId: prepared.studentId,
            eventType: StudentHistoryEventType.BANK_SLIP_ISSUED,
            invoiceId: prepared.invoiceId,
            bankSlipId: bankSlip.id,
            performedByUserId: userId,
          },
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.BANK_SLIP_ISSUED,
          recordId: bankSlip.id,
          userId,
          metadata: {
            invoiceId: prepared.invoiceId,
            studentId: prepared.studentId,
            bankSlipId: bankSlip.id,
            seuNumero: bankSlip.seuNumero,
            nossoNumero: this.maskNossoNumero(bankSlip.nossoNumero),
            txidPresent: Boolean(bankSlip.txid),
            status: bankSlip.status,
          },
        });
        return bankSlip;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      await this.markIssuePersistenceConflict(prepared, response, userId, error);
      throw new ConflictException({
        code: "BANK_SLIP_ISSUE_PERSISTENCE_CONFLICT",
        message:
          "Sicredi confirmou a emissao, mas o retorno nao foi persistido localmente; recupere o boleto sem nova emissao",
      });
    }
  }

  private async markIssuePersistenceConflict(
    prepared: IssuePreparation,
    response: SicrediIssueBankSlipResponse,
    userId: string,
    error: unknown,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const bankSlip = await tx.bankSlip.update({
        where: { id: prepared.bankSlipId },
        data: {
          status: BankSlipStatus.UNKNOWN,
          txid: response.txid ?? null,
          linhaDigitavel: response.linhaDigitavel,
          codigoBarras: response.codigoBarras,
          providerStatus: "ISSUED",
          providerErrorCode: "BANK_SLIP_PERSISTENCE_CONFLICT",
          providerErrorMessage:
            "Sicredi retornou HTTP 201, mas houve conflito ao persistir o identificador bancario local.",
          lastCheckedAt: new Date(),
        },
        include: this.bankSlipInclude(),
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED,
        recordId: bankSlip.id,
        userId,
        metadata: {
          invoiceId: prepared.invoiceId,
          studentId: prepared.studentId,
          bankSlipId: bankSlip.id,
          seuNumero: bankSlip.seuNumero,
          nossoNumero: this.maskNossoNumero(response.nossoNumero),
          txidPresent: Boolean(response.txid),
          status: bankSlip.status,
          code: "BANK_SLIP_PERSISTENCE_CONFLICT",
          prismaCode: getPrismaErrorCode(error) ?? "",
        },
      });
    });
  }

  async getByInvoice(invoiceId: string) {
    const bankSlip = await this.getBankSlipByInvoice(invoiceId);
    return this.toBankSlipSummary(bankSlip);
  }

  async syncByInvoice(invoiceId: string, userId: string) {
    const bankSlip = await this.getBankSlipByInvoice(invoiceId);
    if (!bankSlip.nossoNumero) {
      throw new BadRequestException({
        code: "BANK_SLIP_NOT_ISSUED",
        message: "Boleto ainda nao possui Nosso Numero para consulta",
      });
    }
    try {
      const details = await this.sicredi.getBankSlip(bankSlip.nossoNumero);
      return this.applyProviderDetails(bankSlip.id, details, userId);
    } catch (error) {
      if (error instanceof SicrediClientError) {
        throw toSicrediHttpException(translateSicrediClientError(error, "sync"));
      }
      throw error;
    }
  }

  async syncPaidByDay(day: string, userId: string) {
    const sicrediDay = this.toSicrediDay(day);
    const summary = {
      date: day,
      pagesProcessed: 0,
      recordsReceived: 0,
      bankSlipsFound: 0,
      paymentsConfirmed: 0,
      alreadySynced: 0,
      notFound: 0,
      errors: [] as Array<{ seuNumero: string; nossoNumero: string; code: string }>,
    };
    try {
      for await (const page of this.sicredi.iteratePaidBankSlipsByDay({
        day: sicrediDay,
        maxPages: 20,
      })) {
        summary.pagesProcessed += 1;
        summary.recordsReceived += page.items.length;
        for (const item of page.items) {
          const bankSlip = await this.findBankSlipForPaidItem(item);
          if (!bankSlip) {
            summary.notFound += 1;
            continue;
          }
          summary.bankSlipsFound += 1;
          try {
            const result = await this.applyPaidItem(bankSlip.id, item, userId);
            if (result.changed) {
              summary.paymentsConfirmed += 1;
            } else {
              summary.alreadySynced += 1;
            }
          } catch {
            summary.errors.push({
              seuNumero: item.seuNumero,
              nossoNumero: this.maskNossoNumero(item.nossoNumero),
              code: "PAYMENT_SYNC_CONFLICT",
            });
          }
        }
      }
    } catch (error) {
      if (error instanceof SicrediClientError) {
        throw toSicrediHttpException(translateSicrediClientError(error, "syncPaidByDay"));
      }
      throw error;
    }
    await this.prisma.administrativeAuditLog.create({
      data: {
        eventType: AdministrativeAuditEventType.BANK_SLIP_SYNCED,
        userId,
        domain: "bank_slips",
        recordId: userId,
        metadata: {
          date: day,
          pagesProcessed: summary.pagesProcessed,
          recordsReceived: summary.recordsReceived,
          bankSlipsFound: summary.bankSlipsFound,
          paymentsConfirmed: summary.paymentsConfirmed,
          alreadySynced: summary.alreadySynced,
          notFound: summary.notFound,
          errorCount: summary.errors.length,
        },
      },
    });
    return summary;
  }

  async syncOpenIssued(userId?: string) {
    const type = userId
      ? BankSlipSyncRunType.MANUAL_OPEN_ISSUED
      : BankSlipSyncRunType.AUTOMATIC_OPEN_ISSUED;
    const locked = await this.acquireOpenIssuedSyncLock();
    if (!locked) {
      return this.createSkippedSyncRun(type, userId);
    }

    const run = await this.prisma.bankSlipSyncRun.create({
      data: {
        type,
        startedByUserId: userId,
        metadata: {
          limit: this.sicrediConfig.syncOpenIssuedLimit,
          environment: this.environment(),
        },
      },
    });
    const counters = {
      scannedCount: 0,
      updatedCount: 0,
      paidCount: 0,
      cancelledCount: 0,
      errorCount: 0,
    };

    try {
      const bankSlips = await this.findOpenIssuedBankSlipsForSync();
      for (const bankSlip of bankSlips) {
        counters.scannedCount += 1;
        try {
          const result = await this.syncOpenIssuedBankSlip(run.id, bankSlip, userId);
          if (result.updated) {
            counters.updatedCount += 1;
          }
          if (result.status === BankSlipSyncRunItemStatus.PAID) {
            counters.paidCount += 1;
          }
          if (result.status === BankSlipSyncRunItemStatus.CANCELLED) {
            counters.cancelledCount += 1;
          }
          if (
            result.status === BankSlipSyncRunItemStatus.ERROR ||
            result.status === BankSlipSyncRunItemStatus.NOT_FOUND ||
            result.status === BankSlipSyncRunItemStatus.PARTIAL_PAYMENT_REVIEW
          ) {
            counters.errorCount += 1;
          }
        } catch (error) {
          counters.errorCount += 1;
          await this.recordSyncRunItem(run.id, bankSlip, {
            itemStatus: BankSlipSyncRunItemStatus.ERROR,
            previousStatus: bankSlip.status,
            newStatus: bankSlip.status,
            errorCode: "SYNC_ITEM_FAILED",
            errorMessage: error instanceof Error ? error.message : "Falha inesperada na sincronizacao",
          });
          this.logger.warn({
            event: "sicredi_open_issued_sync_item_failed",
            runId: run.id,
            bankSlipId: bankSlip.id,
            invoiceId: bankSlip.invoiceId,
            errorType: error instanceof Error ? error.name : typeof error,
          });
        }
      }
      const finalStatus =
        counters.errorCount > 0
          ? BankSlipSyncRunStatus.COMPLETED_WITH_ERRORS
          : BankSlipSyncRunStatus.COMPLETED;
      return this.finishSyncRun(run.id, finalStatus, counters);
    } catch (error) {
      counters.errorCount += 1;
      this.logger.error({
        event: "sicredi_open_issued_sync_failed",
        runId: run.id,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      await this.finishSyncRun(run.id, BankSlipSyncRunStatus.FAILED, counters, {
        errorCode: "SYNC_RUN_FAILED",
        errorMessage:
          error instanceof Error
            ? (this.truncate(error.message, 500) ?? "Falha inesperada")
            : "Falha inesperada",
      });
      throw error;
    } finally {
      await this.releaseOpenIssuedSyncLock();
    }
  }

  async listSyncRuns(query: ListBankSlipSyncRunsDto) {
    const pagination = resolvePagination(query, { defaultLimit: 20, maxLimit: 100 });
    const [records, total] = await Promise.all([
      this.prisma.bankSlipSyncRun.findMany({
        orderBy: [{ startedAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.bankSlipSyncRun.count(),
    ]);
    return {
      data: records,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getSyncRun(id: string) {
    const record = await this.prisma.bankSlipSyncRun.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException("Execucao de sincronizacao nao encontrada");
    }
    return record;
  }

  async listSyncRunItems(runId: string, query: ListBankSlipSyncRunItemsDto) {
    await this.getSyncRun(runId);
    const pagination = resolvePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const [records, total] = await Promise.all([
      this.prisma.bankSlipSyncRunItem.findMany({
        where: { runId },
        orderBy: [{ checkedAt: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.bankSlipSyncRunItem.count({ where: { runId } }),
    ]);
    return {
      data: records,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async requestCancellation(
    invoiceId: string,
    userId: string,
    body: RequestBankSlipCancellationDto,
  ) {
    if (!body.reason) {
      throw new BadRequestException({
        code: "BANK_SLIP_CANCELLATION_REASON_REQUIRED",
        message: "Motivo administrativo e obrigatorio para baixa bancaria",
      });
    }
    const prepared = await this.prepareCancellation(invoiceId, userId, body);
    try {
      const response = await this.sicredi.requestCancellation(prepared.nossoNumero);
      const updated = await this.prisma.$transaction(async (tx) => {
        const bankSlip = await tx.bankSlip.update({
          where: { id: prepared.bankSlipId },
          data: {
            status: BankSlipStatus.PENDING_CANCELLATION,
            providerStatus: response.statusComando,
            providerErrorCode: null,
            providerErrorMessage: null,
            lastCheckedAt: new Date(),
          },
          include: this.bankSlipInclude(),
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.BANK_SLIP_CANCELLATION_REQUESTED,
          recordId: bankSlip.id,
          userId,
          metadata: {
            invoiceId: bankSlip.invoiceId,
            studentId: bankSlip.invoice.studentId,
            bankSlipId: bankSlip.id,
            seuNumero: bankSlip.seuNumero,
            nossoNumero: this.maskNossoNumero(bankSlip.nossoNumero),
            statusAnterior: prepared.previousStatus,
            statusNovo: bankSlip.status,
            providerStatus: response.statusComando,
            reason: prepared.reason,
          },
        });
        return bankSlip;
      });
      return this.toBankSlipSummary(updated);
    } catch (error) {
      if (!(error instanceof SicrediClientError)) {
        throw error;
      }
      const translated = translateSicrediClientError(error, "cancellation");
      if (
        translated.cancellationOutcome === "ALREADY_PAID" ||
        translated.cancellationOutcome === "ALREADY_CANCELLED"
      ) {
        return this.confirmCancellationConflictBySync(prepared, translated, userId);
      }
      const failed = await this.prisma.$transaction(async (tx) => {
        const status =
          translated.cancellationOutcome === "NOT_FOUND"
            ? prepared.previousStatus
            : translated.cancellationOutcome === "PROCESSING" || translated.uncertain
              ? BankSlipStatus.PENDING_CANCELLATION
              : BankSlipStatus.CANCELLATION_FAILED;
        const bankSlip = await tx.bankSlip.update({
          where: { id: prepared.bankSlipId },
          data: {
            status,
            providerErrorCode: this.truncate(translated.providerCode, 80),
            providerErrorMessage: translated.message,
            lastCheckedAt: new Date(),
          },
          include: this.bankSlipInclude(),
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.BANK_SLIP_SYNCED,
          recordId: bankSlip.id,
          userId,
          metadata: {
            invoiceId: bankSlip.invoiceId,
            bankSlipId: bankSlip.id,
            seuNumero: bankSlip.seuNumero,
            nossoNumero: this.maskNossoNumero(bankSlip.nossoNumero),
            statusAnterior: prepared.previousStatus,
            statusNovo: bankSlip.status,
            code: translated.providerCode ?? "",
            uncertain: translated.uncertain,
          },
        });
        return bankSlip;
      });
      const body = {
        code: translated.code,
        message: translated.message,
        bankSlip: this.toBankSlipSummary(failed),
      };
      if (translated.code === "SICREDI_NOT_FOUND") {
        throw new NotFoundException(body);
      }
      if (translated.code === "SICREDI_TEMPORARILY_UNAVAILABLE") {
        throw new ServiceUnavailableException(body);
      }
      if (translated.code === "SICREDI_CONFLICT") {
        throw new ConflictException(body);
      }
      throw new BadRequestException(body);
    }
  }

  async getPdf(invoiceId: string) {
    const bankSlip = await this.getBankSlipByInvoice(invoiceId);
    if (!bankSlip.linhaDigitavel) {
      throw new BadRequestException("Boleto ainda nao possui linha digitavel para PDF");
    }
    if (
      bankSlip.status !== BankSlipStatus.ISSUED &&
      bankSlip.status !== BankSlipStatus.PAID &&
      bankSlip.status !== BankSlipStatus.PENDING_CANCELLATION
    ) {
      throw new BadRequestException("PDF disponivel somente para boleto emitido");
    }
    try {
      const pdf = await this.sicredi.getPdf(bankSlip.linhaDigitavel);
      if (pdf.sizeBytes <= 0) {
        throw new BadRequestException({
          code: "SICREDI_INVALID_RESPONSE",
          message: "PDF do boleto esta vazio",
        });
      }
      return pdf;
    } catch (error) {
      if (error instanceof SicrediClientError) {
        throw toSicrediHttpException(translateSicrediClientError(error, "pdf"));
      }
      throw error;
    }
  }

  private async prepareIssue(
    invoiceId: string,
    userId: string,
  ): Promise<IssuePreparationResult> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (invoice.status !== InvoiceStatus.OPEN) {
        throw new BadRequestException({
          code:
            invoice.status === InvoiceStatus.PAID
              ? "INVOICE_ALREADY_PAID"
              : "INVOICE_NOT_OPEN",
          message: "Somente fatura aberta pode emitir boleto",
        });
      }
      if (isInvoiceOverdue(invoice)) {
        throw new BadRequestException({
          code: "DUE_DATE_IN_PAST",
          message: "Vencimento da fatura deve ser hoje ou futuro",
        });
      }
      const currentBankSlip = invoice.bankSlip
        ? await this.resolveStalePendingIssueTx(tx, invoice, userId)
        : null;
      if (currentBankSlip && !this.canRetryIssue(currentBankSlip.status)) {
        if (currentBankSlip.status === BankSlipStatus.ISSUED) {
          const issuedBankSlip = await tx.bankSlip.findUnique({
            where: { id: currentBankSlip.id },
            include: this.bankSlipInclude(),
          });
          if (!issuedBankSlip) {
            throw new NotFoundException("Boleto nao encontrado");
          }
          return { kind: "already-issued", bankSlip: issuedBankSlip };
        }
        if (currentBankSlip.status === BankSlipStatus.PENDING_ISSUE) {
          throw new ConflictException({
            code: "BANK_SLIP_ISSUE_IN_PROGRESS",
            message: "Emissao de boleto em andamento para esta fatura",
          });
        }
        throw new ConflictException({
          code:
            currentBankSlip.status === BankSlipStatus.UNKNOWN
              ? "BANK_SLIP_ISSUE_UNKNOWN"
              : "BANK_SLIP_ALREADY_EXISTS",
          message: "Fatura ja possui boleto vinculado",
        });
      }
      if (invoice.enrollment.status !== EnrollmentStatus.ACTIVE) {
        throw new BadRequestException("Matricula da fatura nao esta ativa");
      }
      const payer = this.buildPayer(invoice.student.person);
      const seuNumero = await this.nextSeuNumero(tx);
      const previousStatus = currentBankSlip?.status ?? null;
      const bankSlip = currentBankSlip
        ? await this.prepareRetryIssueTx(tx, currentBankSlip, invoice, seuNumero)
        : await tx.bankSlip.create({
            data: {
              invoiceId: invoice.id,
              provider: BankSlipProvider.SICREDI,
              environment: this.environment(),
              status: BankSlipStatus.PENDING_ISSUE,
              documentSpecies: "RECIBO",
              seuNumero,
              originalAmountCents: invoice.amountCents,
            },
          });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BANK_SLIP_ISSUE_REQUESTED,
        recordId: bankSlip.id,
        userId,
        metadata: {
          invoiceId: invoice.id,
          studentId: invoice.studentId,
          bankSlipId: bankSlip.id,
          seuNumero,
          amountCents: invoice.amountCents,
          dueDate: this.toDateOnly(invoice.dueDate),
          retry: Boolean(previousStatus),
          ...(previousStatus ? { previousStatus } : {}),
        },
      });
      return {
        kind: "issue",
        bankSlipId: bankSlip.id,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amountCents: invoice.amountCents,
        dueDate: this.toDateOnly(invoice.dueDate),
        seuNumero,
        documentSpecies: bankSlip.documentSpecies,
        input: {
          pagador: payer,
          especieDocumento: bankSlip.documentSpecies,
          seuNumero,
          dataVencimento: this.toDateOnly(invoice.dueDate),
          valor: formatCentsAsSicrediAmount(invoice.amountCents),
        },
      };
    });
  }

  private canRetryIssue(status: BankSlipStatus) {
    return (
      status === BankSlipStatus.ISSUE_FAILED ||
      status === BankSlipStatus.CANCELLED
    );
  }

  private async prepareRetryIssueTx(
    tx: Prisma.TransactionClient,
    bankSlip: NonNullable<InvoiceWithRelations["bankSlip"]>,
    invoice: InvoiceWithRelations,
    seuNumero: string,
  ) {
    return tx.bankSlip.update({
      where: { id: bankSlip.id },
      data: {
        provider: BankSlipProvider.SICREDI,
        environment: this.environment(),
        status: BankSlipStatus.PENDING_ISSUE,
        documentSpecies: "RECIBO",
        seuNumero,
        originalAmountCents: invoice.amountCents,
        nossoNumero: null,
        txid: null,
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
      },
      include: this.bankSlipInclude(),
    });
  }

  private async resolveStalePendingIssueTx(
    tx: Prisma.TransactionClient,
    invoice: InvoiceWithRelations,
    userId: string,
  ) {
    const bankSlip = invoice.bankSlip;
    if (!bankSlip) {
      return null;
    }
    if (
      bankSlip.status !== BankSlipStatus.PENDING_ISSUE ||
      Date.now() - bankSlip.updatedAt.getTime() < PENDING_ISSUE_STALE_MS
    ) {
      return bankSlip;
    }

    const updated = await tx.bankSlip.update({
      where: { id: bankSlip.id },
      data: {
        status: BankSlipStatus.UNKNOWN,
        providerErrorCode: "PENDING_ISSUE_STALE",
        providerErrorMessage:
          "Emissao de boleto ficou pendente por muito tempo; consulte o Sicredi antes de nova tentativa.",
        lastCheckedAt: new Date(),
      },
      include: this.bankSlipInclude(),
    });
    await this.recordAuditTx(tx, {
      eventType: AdministrativeAuditEventType.BANK_SLIP_ISSUE_FAILED,
      recordId: updated.id,
      userId,
      metadata: {
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        bankSlipId: updated.id,
        seuNumero: updated.seuNumero,
        previousStatus: BankSlipStatus.PENDING_ISSUE,
        status: updated.status,
        code: "PENDING_ISSUE_STALE",
      },
    });
    return updated;
  }

  private async prepareCancellation(
    invoiceId: string,
    userId: string,
    body: RequestBankSlipCancellationDto,
  ): Promise<CancellationPreparation> {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, invoiceId);
      const bankSlip = invoice.bankSlip;
      if (!bankSlip) {
        throw new NotFoundException("Boleto nao encontrado para esta fatura");
      }
      if (!bankSlip.nossoNumero) {
        throw new BadRequestException({
          code: "BANK_SLIP_NOT_ISSUED",
          message: "Boleto ainda nao possui Nosso Numero para baixa",
        });
      }
      if (invoice.status !== InvoiceStatus.OPEN) {
        throw new BadRequestException({
          code:
            invoice.status === InvoiceStatus.PAID
              ? "INVOICE_ALREADY_PAID"
              : "INVOICE_NOT_OPEN",
          message: "Somente fatura aberta pode solicitar baixa bancaria",
        });
      }
      if (bankSlip.status === BankSlipStatus.PAID) {
        throw new BadRequestException({
          code: "BANK_SLIP_ALREADY_PAID",
          message: "Boleto liquidado nao pode receber pedido de baixa",
        });
      }
      if (bankSlip.status === BankSlipStatus.CANCELLED) {
        throw new BadRequestException({
          code: "BANK_SLIP_ALREADY_CANCELLED",
          message: "Boleto ja esta baixado/cancelado",
        });
      }
      if (bankSlip.status === BankSlipStatus.PENDING_CANCELLATION) {
        throw new ConflictException({
          code: "BANK_SLIP_CANCELLATION_PENDING",
          message: "Boleto ja possui baixa em processamento",
        });
      }
      if (bankSlip.status !== BankSlipStatus.ISSUED) {
        throw new BadRequestException({
          code: "BANK_SLIP_NOT_ISSUED",
          message: "Baixa permitida somente para boleto emitido",
        });
      }

      const previousStatus = bankSlip.status;
      const updated = await tx.bankSlip.update({
        where: { id: bankSlip.id },
        data: {
          status: BankSlipStatus.PENDING_CANCELLATION,
          cancellationRequestedAt: new Date(),
          cancellationRequestedByUserId: userId,
          cancellationReason: body.reason,
          cancellationNote: body.note,
          providerErrorCode: null,
          providerErrorMessage: null,
          lastCheckedAt: new Date(),
        },
        include: this.bankSlipInclude(),
      });
      await tx.studentHistoryEvent.create({
        data: {
          studentId: invoice.studentId,
          eventType: StudentHistoryEventType.BANK_SLIP_CANCELLATION_REQUESTED,
          invoiceId: invoice.id,
          bankSlipId: bankSlip.id,
          justification: body.note ?? body.reason,
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BANK_SLIP_CANCELLATION_REQUESTED,
        recordId: bankSlip.id,
        userId,
        metadata: {
          invoiceId: invoice.id,
          studentId: invoice.studentId,
          bankSlipId: bankSlip.id,
          seuNumero: bankSlip.seuNumero,
          nossoNumero: this.maskNossoNumero(bankSlip.nossoNumero),
          statusAnterior: previousStatus,
          statusNovo: updated.status,
          reason: body.reason,
        },
      });
      return {
        bankSlipId: bankSlip.id,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        nossoNumero: bankSlip.nossoNumero,
        previousStatus,
        reason: body.reason,
      };
    });
  }

  private async applyProviderDetails(id: string, details: SicrediBankSlipDetails, userId?: string) {
    const mappedStatus = mapSicrediStatusToBankSlipStatus(details.situacao);
    const paidAmountCents = details.dadosLiquidacao?.valor
      ? parseSicrediAmountToCents(details.dadosLiquidacao.valor)
      : undefined;
    const paidAt = details.dadosLiquidacao?.data
      ? this.parseProviderDate(details.dadosLiquidacao.data)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockBankSlip(tx, id);
      if (
        mappedStatus === BankSlipStatus.PAID &&
        (current.status === BankSlipStatus.CANCELLED ||
          current.invoice.status === InvoiceStatus.CANCELLED)
      ) {
        throw new ConflictException("Estado bancario conflitante para confirmacao de pagamento");
      }
      if (
        mappedStatus === BankSlipStatus.CANCELLED &&
        (current.status === BankSlipStatus.PAID ||
          current.invoice.status === InvoiceStatus.PAID)
      ) {
        throw new ConflictException("Estado bancario conflitante para confirmacao de baixa");
      }
      const update: Prisma.BankSlipUpdateInput = {
        providerStatus: details.situacao,
        linhaDigitavel: details.linhaDigitavel ?? current.linhaDigitavel,
        codigoBarras: details.codigoBarras ?? current.codigoBarras,
        paidAmountCents: paidAmountCents ?? current.paidAmountCents,
        paidAt: paidAt ?? current.paidAt,
        lastCheckedAt: new Date(),
      };
      if (mappedStatus === BankSlipStatus.CANCELLED && !current.cancelledAt) {
        update.cancelledAt = new Date();
        if (!current.cancellationRequestedAt) {
          update.providerErrorCode = "BAIXA_EXTERNA_REVIEW";
          update.providerErrorMessage =
            "Boleto baixado no Sicredi sem solicitacao de baixa registrada no ATRETU; fatura mantida aberta para revisao.";
        }
      }
      const resolvedStatus = this.resolveSyncedStatus(current.status, mappedStatus);
      const updated = await tx.bankSlip.update({
        where: { id },
        data: { ...update, status: resolvedStatus },
        include: this.bankSlipInclude(),
      });
      await this.applyInvoiceAndEventsForSync(tx, current, updated, userId);
      return this.toBankSlipSummary(updated);
    });
  }

  private async syncOpenIssuedBankSlip(
    runId: string,
    bankSlip: BankSlipWithRelations,
    userId: string | undefined,
  ) {
    if (!bankSlip.nossoNumero) {
      await this.recordSyncRunItem(runId, bankSlip, {
        itemStatus: BankSlipSyncRunItemStatus.ERROR,
        previousStatus: bankSlip.status,
        newStatus: bankSlip.status,
        errorCode: "BANK_SLIP_NOT_ISSUED",
        errorMessage: "Boleto emitido sem Nosso Numero para consulta",
      });
      return { status: BankSlipSyncRunItemStatus.ERROR, updated: false };
    }

    try {
      const details = await this.sicredi.getBankSlip(bankSlip.nossoNumero);
      const mappedStatus = mapSicrediStatusToBankSlipStatus(details.situacao);
      const paidAmountCents = details.dadosLiquidacao?.valor
        ? parseSicrediAmountToCents(details.dadosLiquidacao.valor)
        : undefined;
      if (
        mappedStatus === BankSlipStatus.PAID &&
        paidAmountCents !== undefined &&
        paidAmountCents < bankSlip.originalAmountCents
      ) {
        const updated = await this.markPartialPaymentReview(bankSlip.id, details, paidAmountCents);
        await this.recordSyncRunItem(runId, bankSlip, {
          itemStatus: BankSlipSyncRunItemStatus.PARTIAL_PAYMENT_REVIEW,
          previousStatus: bankSlip.status,
          newStatus: updated.status,
          providerStatus: details.situacao,
          errorCode: "PARTIAL_PAYMENT_REVIEW",
          errorMessage: "Pagamento parcial recebido; fatura mantida em aberto para revisao",
          metadata: {
            paidAmountCents,
            originalAmountCents: bankSlip.originalAmountCents,
          },
        });
        return { status: BankSlipSyncRunItemStatus.PARTIAL_PAYMENT_REVIEW, updated: true };
      }

      const updated = await this.applyProviderDetails(
        bankSlip.id,
        details,
        userId,
      );
      const itemStatus = this.syncRunItemStatus(bankSlip.status, updated.status);
      await this.recordSyncRunItem(runId, bankSlip, {
        itemStatus,
        previousStatus: bankSlip.status,
        newStatus: updated.status,
        providerStatus: details.situacao,
      });
      return {
        status: itemStatus,
        updated: updated.status !== bankSlip.status || itemStatus !== BankSlipSyncRunItemStatus.CHECKED,
      };
    } catch (error) {
      if (!(error instanceof SicrediClientError)) {
        throw error;
      }
      const translated = translateSicrediClientError(error, "sync");
      await this.markBankSlipCheckedWithProviderError(bankSlip.id, translated);
      const itemStatus =
        translated.code === "SICREDI_NOT_FOUND"
          ? BankSlipSyncRunItemStatus.NOT_FOUND
          : BankSlipSyncRunItemStatus.ERROR;
      await this.recordSyncRunItem(runId, bankSlip, {
        itemStatus,
        previousStatus: bankSlip.status,
        newStatus: bankSlip.status,
        errorCode: translated.code,
        errorMessage: translated.message,
        metadata: {
          transient: translated.transient,
          uncertain: translated.uncertain,
          statusCode: translated.statusCode ?? 0,
          providerCode: translated.providerCode ?? "",
        },
      });
      return { status: itemStatus, updated: false };
    }
  }

  private async markPartialPaymentReview(
    id: string,
    details: SicrediBankSlipDetails,
    paidAmountCents: number,
  ) {
    const paidAt = details.dadosLiquidacao?.data
      ? this.parseProviderDate(details.dadosLiquidacao.data)
      : undefined;
    return this.prisma.bankSlip.update({
      where: { id },
      data: {
        providerStatus: details.situacao,
        paidAmountCents,
        paidAt,
        lastCheckedAt: new Date(),
        providerErrorCode: "PARTIAL_PAYMENT_REVIEW",
        providerErrorMessage:
          "Pagamento parcial recebido; fatura mantida aberta ate definicao da regra operacional.",
      },
      include: this.bankSlipInclude(),
    });
  }

  private async markBankSlipCheckedWithProviderError(
    id: string,
    error: SicrediBusinessError,
  ) {
    await this.prisma.bankSlip.update({
      where: { id },
      data: {
        lastCheckedAt: new Date(),
        providerErrorCode: this.truncate(error.code, 80),
        providerErrorMessage: this.truncate(error.message, 500),
      },
    });
  }

  private syncRunItemStatus(previous: BankSlipStatus, current: BankSlipStatus) {
    if (current === BankSlipStatus.PAID) {
      return BankSlipSyncRunItemStatus.PAID;
    }
    if (current === BankSlipStatus.CANCELLED) {
      return BankSlipSyncRunItemStatus.CANCELLED;
    }
    return previous === current
      ? BankSlipSyncRunItemStatus.CHECKED
      : BankSlipSyncRunItemStatus.UPDATED;
  }

  private async applyPaidItem(id: string, item: SicrediPaidBankSlip, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockBankSlip(tx, id);
      if (current.status === BankSlipStatus.CANCELLED) {
        throw new ConflictException("Boleto cancelado apareceu como liquidado no Sicredi");
      }
      if (current.invoice.status === InvoiceStatus.CANCELLED) {
        throw new ConflictException("Fatura cancelada apareceu como liquidada no Sicredi");
      }
      if (current.status === BankSlipStatus.PAID) {
        return { changed: false, bankSlip: this.toBankSlipSummary(current) };
      }
      const updated = await tx.bankSlip.update({
        where: { id },
        data: {
          status: BankSlipStatus.PAID,
          providerStatus: item.tipoLiquidacao ?? "LIQUIDADO",
          paidAmountCents: parseSicrediAmountToCents(item.valorLiquidado),
          paidAt: this.parseProviderDate(item.dataPagamento),
          lastCheckedAt: new Date(),
        },
        include: this.bankSlipInclude(),
      });
      await this.applyInvoiceAndEventsForSync(tx, current, updated, userId);
      return { changed: true, bankSlip: this.toBankSlipSummary(updated) };
    });
  }

  private async applyInvoiceAndEventsForSync(
    tx: Prisma.TransactionClient,
    previous: BankSlipWithRelations,
    updated: BankSlipWithRelations,
    userId: string | undefined,
  ) {
    if (updated.status === BankSlipStatus.PAID && previous.status !== BankSlipStatus.PAID) {
      if (previous.status === BankSlipStatus.CANCELLED || updated.invoice.status === InvoiceStatus.CANCELLED) {
        throw new ConflictException("Estado bancario conflitante para confirmacao de pagamento");
      }
      await tx.invoice.update({
        where: { id: updated.invoiceId },
        data: { status: InvoiceStatus.PAID },
      });
      await tx.studentHistoryEvent.create({
        data: {
          studentId: updated.invoice.studentId,
          eventType: StudentHistoryEventType.BANK_SLIP_PAYMENT_CONFIRMED,
          invoiceId: updated.invoiceId,
          bankSlipId: updated.id,
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BANK_SLIP_PAYMENT_CONFIRMED,
        recordId: updated.id,
        userId,
        metadata: this.syncMetadata(updated),
      });
    } else if (
      updated.status === BankSlipStatus.CANCELLED &&
      previous.status !== BankSlipStatus.CANCELLED
    ) {
      if (!updated.cancellationRequestedAt) {
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.BANK_SLIP_SYNCED,
          recordId: updated.id,
          userId,
          metadata: {
            ...this.syncMetadata(updated),
            reviewCode: "BAIXA_EXTERNA_REVIEW",
            invoiceKeptOpen: true,
          },
        });
        return;
      }
      await tx.invoice.update({
        where: { id: updated.invoiceId },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: updated.cancellationReason ?? InvoiceCancellationReason.OTHER,
          cancellationNote:
            updated.cancellationNote ?? "Cancelada apos confirmacao de baixa bancaria",
          cancelledByUserId: updated.cancellationRequestedByUserId ?? userId,
        },
      });
      await tx.studentHistoryEvent.create({
        data: {
          studentId: updated.invoice.studentId,
          eventType: StudentHistoryEventType.BANK_SLIP_CANCELLED,
          invoiceId: updated.invoiceId,
          bankSlipId: updated.id,
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BANK_SLIP_CANCELLED,
        recordId: updated.id,
        userId,
        metadata: this.syncMetadata(updated),
      });
    } else {
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BANK_SLIP_SYNCED,
        recordId: updated.id,
        userId,
        metadata: this.syncMetadata(updated),
      });
    }
  }

  private resolveSyncedStatus(current: BankSlipStatus, mapped: BankSlipStatus) {
    if (mapped === BankSlipStatus.UNKNOWN) {
      return current;
    }
    if (
      (current === BankSlipStatus.PAID || current === BankSlipStatus.CANCELLED) &&
      mapped !== current
    ) {
      return current;
    }
    if (current === BankSlipStatus.PENDING_CANCELLATION && mapped === BankSlipStatus.ISSUED) {
      return current;
    }
    return mapped;
  }

  private async findBankSlipForPaidItem(item: SicrediPaidBankSlip) {
    return this.prisma.bankSlip.findFirst({
      where: {
        provider: BankSlipProvider.SICREDI,
        environment: this.environment(),
        OR: [{ nossoNumero: item.nossoNumero }, { seuNumero: item.seuNumero }],
      },
      include: this.bankSlipInclude(),
    });
  }

  private findOpenIssuedBankSlipsForSync() {
    return this.prisma.bankSlip.findMany({
      where: {
        provider: BankSlipProvider.SICREDI,
        environment: this.environment(),
        status: BankSlipStatus.ISSUED,
        invoice: { status: InvoiceStatus.OPEN },
      },
      include: this.bankSlipInclude(),
      orderBy: [
        { lastCheckedAt: { sort: "asc", nulls: "first" } },
        { updatedAt: "asc" },
      ],
      take: this.sicrediConfig.syncOpenIssuedLimit,
    });
  }

  private async acquireOpenIssuedSyncLock() {
    const rows = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_lock(${OPEN_ISSUED_SYNC_LOCK_ID}) AS locked
    `;
    return Boolean(rows[0]?.locked);
  }

  private async releaseOpenIssuedSyncLock() {
    await this.prisma.$queryRaw<Array<{ unlocked: boolean }>>`
      SELECT pg_advisory_unlock(${OPEN_ISSUED_SYNC_LOCK_ID}) AS unlocked
    `;
  }

  private async createSkippedSyncRun(
    type: BankSlipSyncRunType,
    userId: string | undefined,
  ) {
    return this.prisma.bankSlipSyncRun.create({
      data: {
        type,
        status: BankSlipSyncRunStatus.SKIPPED_ALREADY_RUNNING,
        startedByUserId: userId,
        finishedAt: new Date(),
        metadata: { reason: "OPEN_ISSUED_SYNC_ALREADY_RUNNING" },
      },
    });
  }

  private async finishSyncRun(
    id: string,
    status: BankSlipSyncRunStatus,
    counters: {
      scannedCount: number;
      updatedCount: number;
      paidCount: number;
      cancelledCount: number;
      errorCount: number;
    },
    metadata?: Record<string, string | number | boolean | null>,
  ) {
    return this.prisma.bankSlipSyncRun.update({
      where: { id },
      data: {
        status,
        ...counters,
        finishedAt: new Date(),
        ...(metadata ? { metadata } : {}),
      },
    });
  }

  private async recordSyncRunItem(
    runId: string,
    bankSlip: BankSlipWithRelations,
    input: {
      itemStatus: BankSlipSyncRunItemStatus;
      previousStatus?: BankSlipStatus;
      newStatus?: BankSlipStatus;
      providerStatus?: string;
      errorCode?: string;
      errorMessage?: string;
      metadata?: Record<string, string | number | boolean>;
    },
  ) {
    await this.prisma.bankSlipSyncRunItem.create({
      data: {
        runId,
        bankSlipId: bankSlip.id,
        invoiceId: bankSlip.invoiceId,
        status: input.itemStatus,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        providerStatus: this.truncate(input.providerStatus, 80),
        errorCode: this.truncate(input.errorCode, 80),
        errorMessage: this.truncate(input.errorMessage, 500),
        metadata: input.metadata,
      },
    });
  }

  private buildPayer(person: InvoiceWithRelations["student"]["person"]): SicrediIssueBankSlipInput["pagador"] {
    const name = person.fullName.trim();
    if (!name) {
      throw new BadRequestException({
        code: "PAYER_DATA_INCOMPLETE",
        message: "Pagador sem nome valido",
      });
    }
    this.assertMaxLength(name, 40, "PAYER_DATA_INCOMPLETE", "Nome do pagador excede o limite aceito pelo Sicredi");
    if (!isValidCpf(person.cpf)) {
      throw new BadRequestException({
        code: "PAYER_DATA_INCOMPLETE",
        message: "Pagador sem CPF valido",
      });
    }
    if (this.sicrediConfig.requirePayerAddress) {
      const missingAddress =
        !person.addressStreet.trim() ||
        !person.addressCity.trim() ||
        !this.hasEightDigitCep(person.addressZipCode) ||
        !this.hasTwoLetterUf(person.addressState);
      if (missingAddress) {
        throw new BadRequestException({
          code: "PAYER_ADDRESS_REQUIRED",
          message: "Endereco completo do pagador e obrigatorio para Sicredi",
        });
      }
    }
    this.validatePayerOptionalFields(person);
    return {
      tipoPessoa: "PESSOA_FISICA",
      documento: person.cpf,
      nome: name,
      endereco: this.optional(person.addressStreet),
      cidade: this.optional(person.addressCity),
      uf: this.optional(person.addressState)?.toUpperCase(),
      cep: this.onlyDigits(person.addressZipCode),
      telefone: this.optional(person.phone),
      email: this.optional(person.email),
    };
  }

  private async nextSeuNumero(tx: Prisma.TransactionClient) {
    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1::int AS locked FROM pg_advisory_xact_lock(7811003)
    `;
    const latest = await tx.bankSlip.findFirst({
      where: { provider: BankSlipProvider.SICREDI, environment: this.environment() },
      orderBy: { seuNumero: "desc" },
      select: { seuNumero: true },
    });
    const current = latest?.seuNumero.match(/^A(\d{9})$/)?.[1];
    const next = current ? Number.parseInt(current, 10) + 1 : 1;
    if (next > 999_999_999) {
      throw new ConflictException("Sequencia de Seu Numero Sicredi esgotada");
    }
    return `A${String(next).padStart(9, "0")}`;
  }

  private async lockInvoice(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM invoices WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("Fatura nao encontrada");
    }
    const invoice = await tx.invoice.findUnique({
      where: { id },
      include: this.invoiceInclude(),
    });
    if (!invoice) {
      throw new NotFoundException("Fatura nao encontrada");
    }
    return invoice;
  }

  private async lockBankSlip(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM bank_slips WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("Boleto nao encontrado");
    }
    const bankSlip = await tx.bankSlip.findUnique({
      where: { id },
      include: this.bankSlipInclude(),
    });
    if (!bankSlip) {
      throw new NotFoundException("Boleto nao encontrado");
    }
    return bankSlip;
  }

  private async getBankSlipRecord(id: string) {
    const bankSlip = await this.prisma.bankSlip.findUnique({
      where: { id },
      include: this.bankSlipInclude(),
    });
    if (!bankSlip) {
      throw new NotFoundException("Boleto nao encontrado");
    }
    return bankSlip;
  }

  private async getBankSlipByInvoice(invoiceId: string) {
    const bankSlip = await this.prisma.bankSlip.findUnique({
      where: { invoiceId },
      include: this.bankSlipInclude(),
    });
    if (!bankSlip) {
      throw new NotFoundException("Boleto nao encontrado para esta fatura");
    }
    return bankSlip;
  }

  private invoiceInclude() {
    return {
      bankSlip: true,
      student: { include: { person: true } },
      enrollment: true,
    } satisfies Prisma.InvoiceInclude;
  }

  private bankSlipInclude() {
    return {
      invoice: { include: { student: { include: { person: true } } } },
    } satisfies Prisma.BankSlipInclude;
  }

  private toBankSlipSummary(bankSlip: BankSlipWithRelations) {
    return {
      id: bankSlip.id,
      invoiceId: bankSlip.invoiceId,
      provider: bankSlip.provider,
      environment: bankSlip.environment,
      status: bankSlip.status,
      documentSpecies: bankSlip.documentSpecies,
      nossoNumero: bankSlip.nossoNumero,
      seuNumero: bankSlip.seuNumero,
      txid: bankSlip.txid,
      linhaDigitavel: bankSlip.linhaDigitavel,
      codigoBarras: bankSlip.codigoBarras,
      originalAmountCents: bankSlip.originalAmountCents,
      paidAmountCents: bankSlip.paidAmountCents,
      issuedAt: bankSlip.issuedAt,
      paidAt: bankSlip.paidAt,
      cancellationRequestedAt: bankSlip.cancellationRequestedAt,
      cancellationReason: bankSlip.cancellationReason,
      cancellationNote: bankSlip.cancellationNote,
      cancelledAt: bankSlip.cancelledAt,
      lastCheckedAt: bankSlip.lastCheckedAt,
      providerStatus: bankSlip.providerStatus,
      providerErrorCode: bankSlip.providerErrorCode,
      providerErrorMessage: bankSlip.providerErrorMessage,
      createdAt: bankSlip.createdAt,
      updatedAt: bankSlip.updatedAt,
      invoice: {
        id: bankSlip.invoice.id,
        status: bankSlip.invoice.status,
        studentId: bankSlip.invoice.studentId,
        studentName: bankSlip.invoice.student.person.fullName,
        studentCpfMasked: maskCpf(bankSlip.invoice.student.person.cpf),
      },
    };
  }

  private syncMetadata(bankSlip: BankSlipWithRelations) {
    return {
      invoiceId: bankSlip.invoiceId,
      studentId: bankSlip.invoice.studentId,
      bankSlipId: bankSlip.id,
      nossoNumero: this.maskNossoNumero(bankSlip.nossoNumero),
      seuNumero: bankSlip.seuNumero,
      status: bankSlip.status,
      providerStatus: bankSlip.providerStatus ?? "",
    };
  }

  private async recordAuditTx(
    tx: Prisma.TransactionClient,
    input: {
      eventType: AdministrativeAuditEventType;
      recordId: string;
      userId?: string;
      metadata: Record<string, string | number | boolean>;
    },
  ) {
    await tx.administrativeAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        domain: "bank_slips",
        recordId: input.recordId,
        metadata: input.metadata,
      },
    });
  }

  private environment() {
    return this.sicrediConfig.environment === "production"
      ? BankSlipEnvironment.PRODUCTION
      : BankSlipEnvironment.SANDBOX;
  }

  private toSicrediDay(day: string) {
    const [year, month, date] = day.split("-");
    return `${date}/${month}/${year}`;
  }

  private parseProviderDate(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`);
    }
    return new Date(value);
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private maskNossoNumero(value: string | null | undefined) {
    if (!value) {
      return "";
    }
    return `${"*".repeat(Math.max(0, value.length - 3))}${value.slice(-3)}`;
  }

  private optional(value: string | null | undefined) {
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }

  private onlyDigits(value: string | null | undefined) {
    const digits = value?.replace(/\D/g, "");
    return digits && digits.length > 0 ? digits : undefined;
  }

  private truncate(value: string | undefined, maxLength: number) {
    return value ? value.slice(0, maxLength) : undefined;
  }

  private async confirmCancellationConflictBySync(
    prepared: CancellationPreparation,
    translated: SicrediBusinessError,
    userId: string,
  ): Promise<never> {
    try {
      const details = await this.sicredi.getBankSlip(prepared.nossoNumero);
      const bankSlip = await this.applyProviderDetails(prepared.bankSlipId, details, userId);
      throw new ConflictException({
        code: translated.code,
        message:
          translated.cancellationOutcome === "ALREADY_PAID"
            ? "Boleto ja liquidado no Sicredi; baixa bancaria nao foi aplicada"
            : "Boleto ja baixado no Sicredi; estado local foi sincronizado quando confirmado",
        bankSlip,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (error instanceof SicrediClientError) {
        throw toSicrediHttpException(translateSicrediClientError(error, "sync"));
      }
      throw error;
    }
  }

  private validatePayerOptionalFields(person: InvoiceWithRelations["student"]["person"]) {
    this.assertMaxLength(person.addressStreet, 80, "PAYER_ADDRESS_REQUIRED", "Endereco do pagador excede o limite aceito pelo Sicredi");
    this.assertMaxLength(person.addressCity, 25, "PAYER_ADDRESS_REQUIRED", "Cidade do pagador excede o limite aceito pelo Sicredi");
    if (person.addressState && !this.hasTwoLetterUf(person.addressState)) {
      throw new BadRequestException({
        code: "PAYER_ADDRESS_REQUIRED",
        message: "UF do pagador deve ter 2 letras",
      });
    }
    if (person.addressZipCode && !this.hasEightDigitCep(person.addressZipCode)) {
      throw new BadRequestException({
        code: "PAYER_ADDRESS_REQUIRED",
        message: "CEP do pagador deve ter 8 digitos",
      });
    }
    const phone = this.onlyDigits(person.phone);
    if (phone && phone.length > 11) {
      throw new BadRequestException({
        code: "PAYER_DATA_INCOMPLETE",
        message: "Telefone do pagador excede o limite aceito pelo Sicredi",
      });
    }
    this.assertMaxLength(person.email, 40, "PAYER_DATA_INCOMPLETE", "E-mail do pagador excede o limite aceito pelo Sicredi");
  }

  private assertMaxLength(
    value: string | null | undefined,
    maxLength: number,
    code: string,
    message: string,
  ) {
    if (value && value.trim().length > maxLength) {
      throw new BadRequestException({ code, message });
    }
  }

  private hasTwoLetterUf(value: string | null | undefined) {
    return /^[A-Za-z]{2}$/.test(value?.trim() ?? "");
  }

  private hasEightDigitCep(value: string | null | undefined) {
    return /^\d{8}$/.test(value?.replace(/\D/g, "") ?? "");
  }
}

function logIssueDiagnostic(payload: Record<string, unknown>) {
  if (!isIssueDiagnosticEnabled()) {
    return;
  }
  console.info("[sicredi.issueBankSlip.diagnostic]", JSON.stringify(payload));
}

function isIssueDiagnosticEnabled() {
  const nodeEnv = process.env.NODE_ENV?.trim();
  return !nodeEnv || nodeEnv === "development";
}

function sanitizeIssueDiagnosticText(value: string) {
  return value
    .replace(/\b\d{11,14}\b/g, "[redacted-document]")
    .replace(/\bBearer\s+\S+/gi, "[redacted-bearer]")
    .replace(/\b(authorization|x-api-key)\b\s*[:=]?\s*[^,;}\]\s]+/gi, "[redacted-credential]")
    .replace(/\b(token|api[-_ ]?key|senha|password)\b\s*[:=]?\s*[^,;}\]\s]+/gi, "[redacted-secret]")
    .replace(/\b(nome|name|endereco|endereço|address)\b\s*[:=]?\s*[^,;}\]]+/gi, "[redacted-personal]");
}

function isUniqueConstraintError(error: unknown) {
  return getPrismaErrorCode(error) === "P2002";
}

function getPrismaErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: ReturnType<BankSlipsService["invoiceInclude"]>;
}>;

type BankSlipWithRelations = Prisma.BankSlipGetPayload<{
  include: ReturnType<BankSlipsService["bankSlipInclude"]>;
}>;
