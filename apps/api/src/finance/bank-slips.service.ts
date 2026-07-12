import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BankSlipEnvironment,
  BankSlipProvider,
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
  type SicrediPaidBankSlip,
} from "./sicredi-client.js";
import type { SicrediConfig } from "./sicredi-config.js";
import { mapSicrediStatusToBankSlipStatus } from "./bank-slip-status.js";
import type { RequestBankSlipCancellationDto } from "./dto/bank-slips.dto.js";

export const SICREDI_CLIENT = Symbol("SICREDI_CLIENT");
export const SICREDI_CONFIG = Symbol("SICREDI_CONFIG");

type PrismaTx = Prisma.TransactionClient | PrismaService;
type SicrediClientPort = Pick<
  SicrediClient,
  "issueBankSlip" | "getBankSlip" | "iteratePaidBankSlipsByDay" | "requestCancellation" | "getPdf"
>;

type IssuePreparation = {
  bankSlipId: string;
  invoiceId: string;
  studentId: string;
  amountCents: number;
  dueDate: string;
  seuNumero: string;
  documentSpecies: string;
  input: SicrediIssueBankSlipInput;
};

type CancellationPreparation = {
  bankSlipId: string;
  invoiceId: string;
  studentId: string;
  nossoNumero: string;
  previousStatus: BankSlipStatus;
  reason: InvoiceCancellationReason;
};

@Injectable()
export class BankSlipsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SICREDI_CLIENT) private readonly sicredi: SicrediClientPort,
    @Inject(SICREDI_CONFIG) private readonly sicrediConfig: SicrediConfig,
  ) {}

  async issueForInvoice(invoiceId: string, userId: string) {
    const prepared = await this.prepareIssue(invoiceId, userId);
    try {
      const response = await this.sicredi.issueBankSlip(prepared.input);
      const updated = await this.prisma.$transaction(async (tx) => {
        const bankSlip = await tx.bankSlip.update({
          where: { id: prepared.bankSlipId },
          data: {
            status: BankSlipStatus.ISSUED,
            nossoNumero: response.nossoNumero,
            linhaDigitavel: response.linhaDigitavel,
            codigoBarras: response.codigoBarras,
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
            status: bankSlip.status,
          },
        });
        return bankSlip;
      });
      return this.toBankSlipSummary(updated);
    } catch (error) {
      if (!(error instanceof SicrediClientError)) {
        throw error;
      }
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
        code: "SICREDI_REQUEST_REJECTED",
        message: "Sicredi rejeitou a emissao do boleto",
        bankSlip: this.toBankSlipSummary(failed),
      });
    }
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
    const details = await this.sicredi.getBankSlip(bankSlip.nossoNumero);
    return this.applyProviderDetails(bankSlip.id, details, userId);
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
      const failed = await this.prisma.$transaction(async (tx) => {
        const status = error.uncertain
          ? BankSlipStatus.PENDING_CANCELLATION
          : BankSlipStatus.CANCELLATION_FAILED;
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
            code: error.code ?? "",
            uncertain: error.uncertain,
          },
        });
        return bankSlip;
      });
      throw new BadRequestException({
        code: error.uncertain
          ? "SICREDI_TEMPORARILY_UNAVAILABLE"
          : "SICREDI_REQUEST_REJECTED",
        message: error.uncertain
          ? "Pedido de baixa ficou pendente de confirmacao; consulte o Sicredi antes de nova acao"
          : "Sicredi rejeitou o pedido de baixa do boleto",
        bankSlip: this.toBankSlipSummary(failed),
      });
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
    return this.sicredi.getPdf(bankSlip.linhaDigitavel);
  }

  private async prepareIssue(invoiceId: string, userId: string): Promise<IssuePreparation> {
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
      if (invoice.bankSlip) {
        throw new ConflictException({
          code:
            invoice.bankSlip.status === BankSlipStatus.UNKNOWN
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
      const bankSlip = await tx.bankSlip.create({
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
        },
      });
      return {
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
          statusAnterior: bankSlip.status,
          statusNovo: updated.status,
          reason: body.reason,
        },
      });
      return {
        bankSlipId: bankSlip.id,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        nossoNumero: bankSlip.nossoNumero,
        previousStatus: bankSlip.status,
        reason: body.reason,
      };
    });
  }

  private async applyProviderDetails(id: string, details: SicrediBankSlipDetails, userId: string) {
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
    userId: string,
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
    if (
      (current === BankSlipStatus.PAID || current === BankSlipStatus.CANCELLED) &&
      mapped !== current
    ) {
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

  private buildPayer(person: InvoiceWithRelations["student"]["person"]): SicrediIssueBankSlipInput["pagador"] {
    if (!person.fullName.trim()) {
      throw new BadRequestException({
        code: "PAYER_DATA_INCOMPLETE",
        message: "Pagador sem nome valido",
      });
    }
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
        !person.addressZipCode?.trim() ||
        !person.addressState?.trim();
      if (missingAddress) {
        throw new BadRequestException({
          code: "PAYER_ADDRESS_REQUIRED",
          message: "Endereco completo do pagador e obrigatorio para Sicredi",
        });
      }
    }
    return {
      tipoPessoa: "PESSOA_FISICA",
      documento: person.cpf,
      nome: person.fullName.trim(),
      endereco: this.optional(person.addressStreet),
      cidade: this.optional(person.addressCity),
      uf: this.optional(person.addressState),
      cep: this.onlyDigits(person.addressZipCode),
      telefone: this.optional(person.phone),
      email: this.optional(person.email),
    };
  }

  private async nextSeuNumero(tx: Prisma.TransactionClient) {
    await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_advisory_xact_lock(7811003) AS locked`;
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
      userId: string;
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
}

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: ReturnType<BankSlipsService["invoiceInclude"]>;
}>;

type BankSlipWithRelations = Prisma.BankSlipGetPayload<{
  include: ReturnType<BankSlipsService["bankSlipInclude"]>;
}>;
