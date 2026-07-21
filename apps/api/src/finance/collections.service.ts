import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BankSlipStatus,
  CollectionActionSource,
  CollectionActionType,
  CollectionChannel,
  InvoiceStatus,
  Prisma,
  RoleCode,
} from "@prisma/client";
import { resolvePagination } from "../common/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { maskCpf } from "../students/cpf.js";
import type { AuthUser } from "../users/users.service.js";
import { parseInvoiceDueDate, toUtcDateOnly } from "./due-date.js";
import {
  CollectionAgingBucket,
  CollectionFiltersDto,
  CollectionOperationalStatus,
  CollectionPriority,
  CreateCollectionActionDto,
} from "./dto/collections.dto.js";
import { assertValidInvoiceAmountCents, formatInvoiceAmount } from "./money.js";

export const COLLECTIONS_CLOCK = Symbol("COLLECTIONS_CLOCK");

const PARTIAL_PAYMENT_REVIEW_CODE = "PARTIAL_PAYMENT_REVIEW";
const HIGH_AMOUNT_CENTS = 50_000;
const CRITICAL_AMOUNT_CENTS = 100_000;

type PaginationInput = {
  page?: unknown;
  limit?: unknown;
};

type CollectionActionSummary = {
  id: string;
  invoiceId: string;
  actionType: CollectionActionType;
  channel: CollectionChannel | null;
  source: CollectionActionSource;
  contactedName: string | null;
  contactedDocumentMasked: string | null;
  note: string;
  promisedAmountCents: number | null;
  promiseDueDate: string | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
  createdByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type CollectionCaseSummary = {
  invoiceId: string;
  studentId: string;
  enrollmentId: string;
  amountCents: number;
  amountFormatted: string;
  dueDate: string;
  invoiceStatus: InvoiceStatus;
  daysOverdue: number;
  outstandingAmountCents: number;
  outstandingAmountFormatted: string | null;
  agingBucket: CollectionAgingBucket;
  operationalStatus: CollectionOperationalStatus;
  priority: CollectionPriority;
  brokenPromise: boolean;
  partialPaymentReview: boolean;
  nextFollowUpAt: Date | null;
  lastAction: CollectionActionSummary | null;
  student: {
    id: string;
    status: string;
    person: {
      id: string;
      fullName: string;
      cpfMasked: string;
      phone: string | null;
      email: string | null;
    };
    guardian: {
      id: string;
      fullName: string;
      cpf: string | null;
      rg: string | null;
    } | null;
  };
  enrollment: {
    id: string;
    course: string;
    grade: string;
    institution: {
      id: string;
      name: string;
    };
    academicYear: {
      id: string;
      year: number;
    };
  };
  bankSlip: {
    id: string;
    status: BankSlipStatus;
    paidAmountCents: number | null;
    paidAt: Date | null;
    providerErrorCode: string | null;
    providerErrorMessage: string | null;
    nossoNumeroMasked: string | null;
    pdfStoredAt: Date | null;
  } | null;
};

@Injectable()
export class CollectionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional()
    @Inject(COLLECTIONS_CLOCK)
    private readonly clock?: () => Date,
  ) {}

  async getSummary(filters: CollectionFiltersDto, currentUser: AuthUser) {
    this.ensureAllowedUser(currentUser);
    const cases = await this.findDerivedCases(filters, { activeOnly: true });
    const studentIds = new Set(cases.map((item) => item.studentId));
    const totalOverdueCents = cases.reduce(
      (total, item) => total + item.outstandingAmountCents,
      0,
    );

    return {
      totalOverdueCents,
      invoiceCount: cases.length,
      studentCount: studentIds.size,
      averageOverdueAmountCents:
        cases.length > 0 ? Math.round(totalOverdueCents / cases.length) : 0,
      agingBuckets: this.emptyAgingBuckets(cases),
      promisesActiveCount: cases.filter(
        (item) => item.operationalStatus === CollectionOperationalStatus.PROMISE_ACTIVE,
      ).length,
      promisesBrokenCount: cases.filter((item) => item.brokenPromise).length,
      followUpsTodayCount: cases.filter((item) =>
        item.nextFollowUpAt
          ? this.sameUtcDay(item.nextFollowUpAt, this.today())
          : false,
      ).length,
      partialPaymentReviewCount: cases.filter((item) => item.partialPaymentReview)
        .length,
    };
  }

  async listCases(
    filters: CollectionFiltersDto,
    paginationInput: PaginationInput,
    currentUser: AuthUser,
  ) {
    this.ensureAllowedUser(currentUser);
    const pagination = resolvePagination(paginationInput);
    const cases = await this.findDerivedCases(filters, { activeOnly: true });
    const data = cases.slice(pagination.skip, pagination.skip + pagination.limit);

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: cases.length,
        totalPages: Math.ceil(cases.length / pagination.limit),
      },
    };
  }

  async getCaseByInvoiceId(invoiceId: string, currentUser: AuthUser) {
    this.ensureAllowedUser(currentUser);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: this.invoiceInclude(),
    });
    if (!invoice) {
      throw new NotFoundException("Fatura nao encontrada");
    }
    return this.toCollectionCase(invoice);
  }

  async listActions(invoiceId: string, currentUser: AuthUser) {
    this.ensureAllowedUser(currentUser);
    await this.ensureInvoice(invoiceId);
    const actions = await this.prisma.collectionAction.findMany({
      where: { invoiceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: this.actionInclude(),
    });
    return { data: actions.map((action) => this.toActionSummary(action)) };
  }

  async createAction(
    invoiceId: string,
    body: CreateCollectionActionDto,
    currentUser: AuthUser,
  ) {
    this.ensureAllowedUser(currentUser);
    const normalized = this.normalizeActionBody(body);

    const created = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: this.invoiceInclude(),
      });
      if (!invoice) {
        throw new NotFoundException("Fatura nao encontrada");
      }
      if (invoice.status !== InvoiceStatus.OPEN) {
        throw new BadRequestException({
          code: "COLLECTION_ACTION_INVOICE_NOT_OPEN",
          message:
            "Nao e permitido registrar acao operacional em fatura paga ou cancelada",
        });
      }

      const action = await tx.collectionAction.create({
        data: {
          invoiceId,
          actionType: normalized.actionType,
          channel: normalized.channel,
          source: CollectionActionSource.MANUAL,
          contactedName: normalized.contactedName,
          contactedDocumentMasked: normalized.contactedDocumentMasked,
          note: normalized.note,
          promisedAmountCents: normalized.promisedAmountCents,
          promiseDueDate: normalized.promiseDueDate,
          nextFollowUpAt: normalized.nextFollowUpAt,
          createdByUserId: currentUser.id,
        },
        include: this.actionInclude(),
      });

      await tx.administrativeAuditLog.create({
        data: {
          eventType: AdministrativeAuditEventType.COLLECTION_ACTION_CREATED,
          userId: currentUser.id,
          domain: "finance_collections",
          recordId: action.id,
          metadata: {
            invoiceId: invoice.id,
            studentId: invoice.studentId,
            enrollmentId: invoice.enrollmentId,
            institutionId: invoice.enrollment.institutionId,
            academicYearId: invoice.enrollment.academicYearId,
            actionType: action.actionType,
            channel: action.channel ?? "",
            source: action.source,
            promiseDueDate: this.toOptionalDateOnly(action.promiseDueDate),
            promisedAmountCents: action.promisedAmountCents ?? 0,
            nextFollowUpAt: action.nextFollowUpAt?.toISOString() ?? "",
          },
        },
      });

      return action;
    });

    return this.toActionSummary(created);
  }

  async listFollowUps(filters: CollectionFiltersDto, currentUser: AuthUser) {
    this.ensureAllowedUser(currentUser);
    const cases = await this.findDerivedCases(filters, { activeOnly: true });
    return {
      data: cases
        .filter((item) => item.nextFollowUpAt !== null)
        .sort((left, right) =>
          Number(left.nextFollowUpAt) - Number(right.nextFollowUpAt),
        ),
    };
  }

  private async findDerivedCases(
    filters: CollectionFiltersDto,
    options: { activeOnly: boolean },
  ) {
    const records = await this.prisma.invoice.findMany({
      where: this.buildInvoiceWhere(filters, options),
      include: this.invoiceInclude(),
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return records
      .map((invoice) => this.toCollectionCase(invoice))
      .filter((item) => this.matchesDerivedFilters(item, filters));
  }

  private buildInvoiceWhere(
    filters: CollectionFiltersDto,
    options: { activeOnly: boolean },
  ): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};
    if (options.activeOnly) {
      where.status = InvoiceStatus.OPEN;
      where.dueDate = { lt: toUtcDateOnly(this.today()) };
    }
    if (filters.institutionId) {
      where.enrollment = {
        ...(where.enrollment as Prisma.EnrollmentWhereInput | undefined),
        institutionId: filters.institutionId,
      };
    }
    if (filters.academicYearId) {
      where.enrollment = {
        ...(where.enrollment as Prisma.EnrollmentWhereInput | undefined),
        academicYearId: filters.academicYearId,
      };
    }
    if (filters.studentId) {
      where.studentId = filters.studentId;
    }
    if (filters.dueDateFrom || filters.dueDateTo) {
      const dueDate = {
        ...((where.dueDate as Prisma.DateTimeFilter<"Invoice"> | undefined) ?? {}),
      };
      if (filters.dueDateFrom) {
        dueDate.gte = parseInvoiceDueDate(filters.dueDateFrom);
      }
      if (filters.dueDateTo) {
        dueDate.lte = parseInvoiceDueDate(filters.dueDateTo);
      }
      where.dueDate = dueDate;
    }
    if (filters.search) {
      const normalizedSearch = this.normalizeName(filters.search);
      where.OR = [
        {
          student: {
            person: { normalizedName: { contains: normalizedSearch } },
          },
        },
      ];
    }
    if (filters.actionType) {
      where.collectionActions = {
        some: { actionType: filters.actionType },
      };
    }
    if (filters.followUpFrom || filters.followUpTo) {
      const nextFollowUpAt: Prisma.DateTimeFilter<"CollectionAction"> = {};
      if (filters.followUpFrom) {
        nextFollowUpAt.gte = parseInvoiceDueDate(filters.followUpFrom);
      }
      if (filters.followUpTo) {
        const end = parseInvoiceDueDate(filters.followUpTo);
        nextFollowUpAt.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      }
      where.collectionActions = {
        ...((where.collectionActions as Prisma.CollectionActionListRelationFilter | undefined) ??
          {}),
        some: {
          ...((where.collectionActions as { some?: Prisma.CollectionActionWhereInput })
            ?.some ?? {}),
          nextFollowUpAt,
        },
      };
    }
    return where;
  }

  private matchesDerivedFilters(
    item: CollectionCaseSummary,
    filters: CollectionFiltersDto,
  ) {
    if (filters.agingBucket && item.agingBucket !== filters.agingBucket) {
      return false;
    }
    if (
      filters.operationalStatus &&
      item.operationalStatus !== filters.operationalStatus
    ) {
      return false;
    }
    return true;
  }

  private toCollectionCase(invoice: InvoiceWithCollections): CollectionCaseSummary {
    const actions = invoice.collectionActions.map((action) =>
      this.toActionSummary(action),
    );
    const lastAction = actions[0] ?? null;
    const newestPromise = actions.find(
      (action) => action.actionType === CollectionActionType.PROMISE_TO_PAY,
    );
    const nextFollowUpAt = this.nextFollowUp(actions);
    const partialPaymentReview = this.hasPartialPaymentReview(invoice);
    const daysOverdue = this.daysOverdue(invoice.dueDate);
    const outstandingAmountCents = this.outstandingAmount(invoice);
    const brokenPromise = Boolean(
      newestPromise?.promiseDueDate &&
        parseInvoiceDueDate(newestPromise.promiseDueDate).getTime() <
          toUtcDateOnly(this.today()).getTime() &&
        invoice.status === InvoiceStatus.OPEN,
    );
    const operationalStatus = this.operationalStatus({
      invoice,
      lastAction,
      newestPromise,
      nextFollowUpAt,
      brokenPromise,
      partialPaymentReview,
    });
    const agingBucket = this.agingBucket(daysOverdue);
    const priority = this.priority({
      daysOverdue,
      outstandingAmountCents,
      brokenPromise,
      partialPaymentReview,
    });

    return {
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      enrollmentId: invoice.enrollmentId,
      amountCents: invoice.amountCents,
      amountFormatted: formatInvoiceAmount(invoice.amountCents),
      dueDate: this.toDateOnly(invoice.dueDate),
      invoiceStatus: invoice.status,
      daysOverdue,
      outstandingAmountCents,
      outstandingAmountFormatted:
        outstandingAmountCents > 0
          ? formatInvoiceAmount(outstandingAmountCents)
          : null,
      agingBucket,
      operationalStatus,
      priority,
      brokenPromise,
      partialPaymentReview,
      nextFollowUpAt,
      lastAction,
      student: {
        id: invoice.student.id,
        status: invoice.student.status,
        person: {
          id: invoice.student.person.id,
          fullName: invoice.student.person.fullName,
          cpfMasked: maskCpf(invoice.student.person.cpf),
          phone: invoice.student.person.phone,
          email: invoice.student.person.email,
        },
        guardian: invoice.student.guardian,
      },
      enrollment: {
        id: invoice.enrollment.id,
        course: invoice.enrollment.course,
        grade: invoice.enrollment.grade,
        institution: {
          id: invoice.enrollment.institution.id,
          name: invoice.enrollment.institution.name,
        },
        academicYear: {
          id: invoice.enrollment.academicYear.id,
          year: invoice.enrollment.academicYear.year,
        },
      },
      bankSlip: invoice.bankSlip
        ? {
            id: invoice.bankSlip.id,
            status: invoice.bankSlip.status,
            paidAmountCents: invoice.bankSlip.paidAmountCents,
            paidAt: invoice.bankSlip.paidAt,
            providerErrorCode: invoice.bankSlip.providerErrorCode,
            providerErrorMessage: invoice.bankSlip.providerErrorMessage,
            nossoNumeroMasked: this.maskNossoNumero(invoice.bankSlip.nossoNumero),
            pdfStoredAt: invoice.bankSlip.pdfStoredAt,
          }
        : null,
    };
  }

  private toActionSummary(action: CollectionActionWithUser): CollectionActionSummary {
    return {
      id: action.id,
      invoiceId: action.invoiceId,
      actionType: action.actionType,
      channel: action.channel,
      source: action.source,
      contactedName: action.contactedName,
      contactedDocumentMasked: action.contactedDocumentMasked,
      note: action.note,
      promisedAmountCents: action.promisedAmountCents,
      promiseDueDate: this.toOptionalDateOnly(action.promiseDueDate),
      nextFollowUpAt: action.nextFollowUpAt,
      createdAt: action.createdAt,
      createdByUser: action.createdBy,
    };
  }

  private operationalStatus(input: {
    invoice: InvoiceWithCollections;
    lastAction: CollectionActionSummary | null;
    newestPromise: CollectionActionSummary | undefined;
    nextFollowUpAt: Date | null;
    brokenPromise: boolean;
    partialPaymentReview: boolean;
  }) {
    if (input.invoice.status === InvoiceStatus.CANCELLED) {
      return CollectionOperationalStatus.CANCELLED;
    }
    if (input.invoice.status === InvoiceStatus.PAID) {
      return CollectionOperationalStatus.RESOLVED_BY_PAYMENT;
    }
    if (input.partialPaymentReview) {
      return CollectionOperationalStatus.PARTIAL_PAYMENT_REVIEW;
    }
    if (input.brokenPromise) {
      return CollectionOperationalStatus.PROMISE_BROKEN;
    }
    if (input.nextFollowUpAt && input.nextFollowUpAt > this.today()) {
      return CollectionOperationalStatus.FOLLOW_UP_SCHEDULED;
    }
    if (
      input.newestPromise?.promiseDueDate &&
      parseInvoiceDueDate(input.newestPromise.promiseDueDate).getTime() >=
        toUtcDateOnly(this.today()).getTime()
    ) {
      return CollectionOperationalStatus.PROMISE_ACTIVE;
    }
    if (input.lastAction?.actionType === CollectionActionType.CONTACT_MADE) {
      return CollectionOperationalStatus.CONTACTED;
    }
    if (
      input.lastAction?.actionType === CollectionActionType.NO_CONTACT ||
      input.lastAction?.actionType === CollectionActionType.CONTACT_ATTEMPT
    ) {
      return CollectionOperationalStatus.NO_CONTACT;
    }
    return CollectionOperationalStatus.OVERDUE_NO_ACTION;
  }

  private priority(input: {
    daysOverdue: number;
    outstandingAmountCents: number;
    brokenPromise: boolean;
    partialPaymentReview: boolean;
  }) {
    if (
      input.brokenPromise ||
      input.partialPaymentReview ||
      input.daysOverdue > 90 ||
      input.outstandingAmountCents >= CRITICAL_AMOUNT_CENTS
    ) {
      return CollectionPriority.CRITICAL;
    }
    if (
      input.daysOverdue > 60 ||
      input.outstandingAmountCents >= HIGH_AMOUNT_CENTS
    ) {
      return CollectionPriority.HIGH;
    }
    return CollectionPriority.NORMAL;
  }

  private agingBucket(daysOverdue: number) {
    if (daysOverdue <= 30) {
      return CollectionAgingBucket.DAYS_1_30;
    }
    if (daysOverdue <= 60) {
      return CollectionAgingBucket.DAYS_31_60;
    }
    if (daysOverdue <= 90) {
      return CollectionAgingBucket.DAYS_61_90;
    }
    return CollectionAgingBucket.DAYS_90_PLUS;
  }

  private outstandingAmount(invoice: InvoiceWithCollections) {
    if (invoice.status !== InvoiceStatus.OPEN) {
      return 0;
    }
    if (this.hasPartialPaymentReview(invoice)) {
      return Math.max(
        invoice.amountCents - (invoice.bankSlip?.paidAmountCents ?? 0),
        0,
      );
    }
    return invoice.amountCents;
  }

  private hasPartialPaymentReview(invoice: InvoiceWithCollections) {
    return invoice.bankSlip?.providerErrorCode === PARTIAL_PAYMENT_REVIEW_CODE;
  }

  private nextFollowUp(actions: CollectionActionSummary[]) {
    return (
      actions
        .filter((action) => action.nextFollowUpAt !== null)
        .map((action) => action.nextFollowUpAt!)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    );
  }

  private normalizeActionBody(body: CreateCollectionActionDto) {
    if (body.source && body.source !== CollectionActionSource.MANUAL) {
      throw new BadRequestException({
        code: "COLLECTION_ACTION_SOURCE_NOT_ALLOWED",
        message: "Somente a origem MANUAL pode ser usada nesta etapa",
      });
    }
    const note = this.optional(body.note);
    if (!note) {
      throw new BadRequestException({
        code: "COLLECTION_ACTION_NOTE_REQUIRED",
        message: "Observacao obrigatoria",
      });
    }
    if (
      body.promisedAmountCents !== undefined &&
      body.promisedAmountCents !== null
    ) {
      try {
        assertValidInvoiceAmountCents(body.promisedAmountCents);
      } catch {
        throw new BadRequestException({
          code: "COLLECTION_ACTION_INVALID_PROMISED_AMOUNT",
          message: "Valor prometido deve ser positivo",
        });
      }
    }
    if (
      body.actionType === CollectionActionType.PROMISE_TO_PAY &&
      !body.promiseDueDate
    ) {
      throw new BadRequestException({
        code: "COLLECTION_ACTION_PROMISE_DATE_REQUIRED",
        message: "Promessa de pagamento exige data",
      });
    }
    if (
      body.actionType === CollectionActionType.FOLLOW_UP_SCHEDULED &&
      !body.nextFollowUpAt
    ) {
      throw new BadRequestException({
        code: "COLLECTION_ACTION_FOLLOW_UP_DATE_REQUIRED",
        message: "Retorno agendado exige data e hora",
      });
    }
    if (
      (body.actionType === CollectionActionType.CONTACT_ATTEMPT ||
        body.actionType === CollectionActionType.CONTACT_MADE ||
        body.actionType === CollectionActionType.NO_CONTACT) &&
      !body.channel
    ) {
      throw new BadRequestException({
        code: "COLLECTION_ACTION_CHANNEL_REQUIRED",
        message: "Canal obrigatorio para acao de contato",
      });
    }

    return {
      actionType: body.actionType,
      channel: body.channel,
      contactedName: this.optional(body.contactedName),
      contactedDocumentMasked: this.optional(body.contactedDocumentMasked),
      note,
      promisedAmountCents: body.promisedAmountCents,
      promiseDueDate: body.promiseDueDate
        ? parseInvoiceDueDate(body.promiseDueDate)
        : undefined,
      nextFollowUpAt: body.nextFollowUpAt
        ? this.parseDateTime(body.nextFollowUpAt, "nextFollowUpAt")
        : undefined,
    };
  }

  private async ensureInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw new NotFoundException("Fatura nao encontrada");
    }
  }

  private ensureAllowedUser(currentUser: AuthUser) {
    if (
      !currentUser.roles.includes(RoleCode.SUPER_ADMIN) &&
      !currentUser.roles.includes(RoleCode.SECRETARIA)
    ) {
      throw new ForbiddenException("Acesso negado");
    }
  }

  private invoiceInclude() {
    return {
      student: {
        include: {
          person: true,
          guardian: true,
        },
      },
      enrollment: {
        include: {
          institution: true,
          academicYear: true,
        },
      },
      bankSlip: true,
      collectionActions: {
        orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
        include: this.actionInclude(),
      },
    } satisfies Prisma.InvoiceInclude;
  }

  private actionInclude() {
    return {
      createdBy: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.CollectionActionInclude;
  }

  private emptyAgingBuckets(cases: CollectionCaseSummary[]) {
    return {
      [CollectionAgingBucket.DAYS_1_30]: cases.filter(
        (item) => item.agingBucket === CollectionAgingBucket.DAYS_1_30,
      ).length,
      [CollectionAgingBucket.DAYS_31_60]: cases.filter(
        (item) => item.agingBucket === CollectionAgingBucket.DAYS_31_60,
      ).length,
      [CollectionAgingBucket.DAYS_61_90]: cases.filter(
        (item) => item.agingBucket === CollectionAgingBucket.DAYS_61_90,
      ).length,
      [CollectionAgingBucket.DAYS_90_PLUS]: cases.filter(
        (item) => item.agingBucket === CollectionAgingBucket.DAYS_90_PLUS,
      ).length,
    };
  }

  private daysOverdue(dueDate: Date) {
    const diffMs =
      toUtcDateOnly(this.today()).getTime() - toUtcDateOnly(dueDate).getTime();
    return Math.max(Math.floor(diffMs / (24 * 60 * 60 * 1000)), 0);
  }

  private sameUtcDay(left: Date, right: Date) {
    return (
      left.getUTCFullYear() === right.getUTCFullYear() &&
      left.getUTCMonth() === right.getUTCMonth() &&
      left.getUTCDate() === right.getUTCDate()
    );
  }

  private today() {
    return this.clock?.() ?? new Date();
  }

  private parseDateTime(input: string, field: string) {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({
        code: "COLLECTION_ACTION_INVALID_DATE",
        message: `${field} invalido`,
      });
    }
    return date;
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  private optional(value?: string | null) {
    return value && value.length > 0 ? value : undefined;
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toOptionalDateOnly(value: Date | null) {
    return value ? this.toDateOnly(value) : null;
  }

  private maskNossoNumero(value: string | null) {
    if (!value) {
      return null;
    }
    return value.length <= 3
      ? value
      : `${"*".repeat(Math.max(value.length - 3, 0))}${value.slice(-3)}`;
  }
}

type CollectionActionWithUser = Prisma.CollectionActionGetPayload<{
  include: ReturnType<CollectionsService["actionInclude"]>;
}>;

type InvoiceWithCollections = Prisma.InvoiceGetPayload<{
  include: ReturnType<CollectionsService["invoiceInclude"]>;
}>;
