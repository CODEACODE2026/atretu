import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BoardMembershipStatus,
  InvoiceStatus,
  Prisma,
  StudentHistoryEventType,
} from "@prisma/client";
import { resolvePagination } from "../common/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { maskCpf, normalizeCpf } from "../students/cpf.js";
import { getFutureInvoiceBlockingReason } from "../students/lifecycle.js";
import { isInvoiceOverdue, parseInvoiceDueDate } from "./due-date.js";
import {
  CancelInvoiceDto,
  CreateInvoiceDto,
  InvoiceOverdueFilter,
  InvoicePreviewDto,
  InvoiceSort,
  ListInvoicesDto,
  SortOrder,
} from "./dto/invoices.dto.js";
import { assertValidInvoiceAmountCents, formatInvoiceAmount } from "./money.js";

type PrismaTx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class InvoicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listInvoices(query: ListInvoicesDto) {
    const where = this.buildInvoiceWhere(query);
    const pagination = this.resolvePagination(query);
    const orderBy = this.buildOrderBy(query);
    const [records, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
        include: this.invoiceInclude(),
      }),
      this.prisma.invoice.count({ where }),
    ]);
    const data = records
      .map((record) => this.toInvoiceSummary(record))
      .filter((record) => this.matchesOverdue(record, query.overdue));

    return {
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getInvoice(id: string) {
    const record = await this.prisma.invoice.findUnique({
      where: { id },
      include: this.invoiceInclude(),
    });
    if (!record) {
      throw new NotFoundException("Fatura nao encontrada");
    }
    return this.toInvoiceSummary(record);
  }

  async listStudentInvoices(studentId: string) {
    await this.ensureStudent(studentId);
    const records = await this.prisma.invoice.findMany({
      where: { studentId },
      include: this.invoiceInclude(),
      orderBy: [{ createdAt: "desc" }],
    });
    return { data: records.map((record) => this.toInvoiceSummary(record)) };
  }

  async previewInvoice(studentId: string, query: InvoicePreviewDto) {
    const result = await this.evaluateEligibility(this.prisma, studentId, query);
    return {
      student: this.toStudentPreview(result.student),
      enrollment: this.toEnrollment(result.enrollment),
      eligible: result.blockingReason === null,
      blockingReason: result.blockingReason,
    };
  }

  async createInvoice(
    studentId: string,
    body: CreateInvoiceDto,
    userId: string,
  ) {
    const normalized = this.normalizeCreateBody(body);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.lockStudent(tx, studentId);

        const existing = await tx.invoice.findUnique({
          where: { idempotencyKey: normalized.idempotencyKey },
          include: this.invoiceInclude(),
        });
        if (existing) {
          this.ensureSameIdempotentPayload(existing, studentId, normalized);
          return existing;
        }

        const eligibility = await this.evaluateEligibility(tx, studentId, body);
        if (eligibility.blockingReason) {
          throw new BadRequestException(eligibility.blockingReason);
        }

        const invoice = await tx.invoice.create({
          data: {
            studentId,
            enrollmentId: eligibility.enrollment.id,
            amountCents: normalized.amountCents,
            dueDate: normalized.dueDate,
            description: normalized.description,
            idempotencyKey: normalized.idempotencyKey,
            createdByUserId: userId,
          },
          include: this.invoiceInclude(),
        });

        await tx.studentHistoryEvent.create({
          data: {
            studentId,
            eventType: StudentHistoryEventType.INVOICE_CREATED,
            invoiceId: invoice.id,
            justification: normalized.description,
            performedByUserId: userId,
          },
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.INVOICE_CREATED,
          domain: "invoices",
          recordId: invoice.id,
          userId,
          metadata: {
            studentId,
            invoiceId: invoice.id,
            enrollmentId: invoice.enrollmentId,
            amountCents: invoice.amountCents,
            dueDate: this.toDateOnly(invoice.dueDate),
            status: invoice.status,
          },
        });

        return invoice;
      });

      return this.toInvoiceSummary(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await this.prisma.invoice.findUnique({
          where: { idempotencyKey: normalized.idempotencyKey },
          include: this.invoiceInclude(),
        });
        if (existing) {
          this.ensureSameIdempotentPayload(existing, studentId, normalized);
          return this.toInvoiceSummary(existing);
        }
      }
      throw error;
    }
  }

  async cancelInvoice(id: string, body: CancelInvoiceDto, userId: string) {
    const note = this.optional(body.note);
    const updated = await this.prisma.$transaction(async (tx) => {
      const invoice = await this.lockInvoice(tx, id);
      if (invoice.status !== InvoiceStatus.OPEN) {
        throw new BadRequestException("Somente fatura aberta pode ser cancelada");
      }

      const cancelled = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: body.reason,
          cancellationNote: note,
          cancelledByUserId: userId,
        },
        include: this.invoiceInclude(),
      });

      await tx.studentHistoryEvent.create({
        data: {
          studentId: cancelled.studentId,
          eventType: StudentHistoryEventType.INVOICE_CANCELLED,
          invoiceId: cancelled.id,
          justification: note ?? body.reason,
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.INVOICE_CANCELLED,
        domain: "invoices",
        recordId: cancelled.id,
        userId,
        metadata: {
          studentId: cancelled.studentId,
          invoiceId: cancelled.id,
          enrollmentId: cancelled.enrollmentId,
          amountCents: cancelled.amountCents,
          dueDate: this.toDateOnly(cancelled.dueDate),
          status: cancelled.status,
          reason: body.reason,
        },
      });

      return cancelled;
    });

    return this.toInvoiceSummary(updated);
  }

  private async evaluateEligibility(
    tx: PrismaTx,
    studentId: string,
    input: InvoicePreviewDto,
  ) {
    const student = await tx.student.findUnique({
      where: { id: studentId },
      include: {
        person: true,
        boardMemberships: {
          where: { status: BoardMembershipStatus.ACTIVE },
          take: 1,
        },
      },
    });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }

    const enrollment = await tx.enrollment.findFirst({
      where: { id: input.enrollmentId, studentId },
      include: this.enrollmentInclude(),
    });
    if (!enrollment) {
      throw new BadRequestException("Matricula nao encontrada para o academico");
    }

    return {
      student,
      enrollment,
      blockingReason: getFutureInvoiceBlockingReason(student),
    };
  }

  private normalizeCreateBody(body: CreateInvoiceDto) {
    try {
      assertValidInvoiceAmountCents(body.amountCents);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Valor invalido",
      );
    }

    let dueDate: Date;
    try {
      dueDate = parseInvoiceDueDate(body.dueDate);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Vencimento invalido",
      );
    }

    return {
      enrollmentId: body.enrollmentId,
      amountCents: body.amountCents,
      dueDate,
      description: this.optional(body.description),
      idempotencyKey: body.idempotencyKey.trim(),
    };
  }

  private ensureSameIdempotentPayload(
    invoice: InvoiceWithRelations,
    studentId: string,
    body: ReturnType<InvoicesService["normalizeCreateBody"]>,
  ) {
    const samePayload =
      invoice.studentId === studentId &&
      invoice.enrollmentId === body.enrollmentId &&
      invoice.amountCents === body.amountCents &&
      this.toDateOnly(invoice.dueDate) === this.toDateOnly(body.dueDate) &&
      (invoice.description ?? undefined) === body.description;

    if (!samePayload) {
      throw new ConflictException("Chave de idempotencia ja usada com outro payload");
    }
  }

  private buildInvoiceWhere(query: ListInvoicesDto): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.academicYearId) {
      where.enrollment = {
        ...(where.enrollment as Prisma.EnrollmentWhereInput | undefined),
        academicYearId: query.academicYearId,
      };
    }
    if (query.institutionId) {
      where.enrollment = {
        ...(where.enrollment as Prisma.EnrollmentWhereInput | undefined),
        institutionId: query.institutionId,
      };
    }
    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) {
        where.dueDate.gte = parseInvoiceDueDate(query.dueDateFrom);
      }
      if (query.dueDateTo) {
        where.dueDate.lte = parseInvoiceDueDate(query.dueDateTo);
      }
    }
    if (query.search) {
      const normalizedSearch = this.normalizeName(query.search);
      const cpfSearch = normalizeCpf(query.search);
      where.OR = [
        { student: { person: { normalizedName: { contains: normalizedSearch } } } },
        ...(cpfSearch
          ? [{ student: { person: { cpf: { contains: cpfSearch } } } }]
          : []),
      ];
    }
    return where;
  }

  private buildOrderBy(
    query: ListInvoicesDto,
  ): Prisma.InvoiceOrderByWithRelationInput[] {
    const direction = query.order === SortOrder.DESC ? "desc" : "asc";
    if (query.sort === InvoiceSort.CREATED_AT) {
      return [{ createdAt: direction }, { dueDate: "asc" }];
    }
    if (query.sort === InvoiceSort.AMOUNT) {
      return [{ amountCents: direction }, { dueDate: "asc" }];
    }
    if (query.sort === InvoiceSort.STUDENT_NAME) {
      return [
        { student: { person: { normalizedName: direction } } },
        { dueDate: "asc" },
      ];
    }
    return [{ dueDate: direction }, { createdAt: "desc" }];
  }

  private resolvePagination(query: ListInvoicesDto) {
    return resolvePagination(query);
  }

  private matchesOverdue(
    invoice: ReturnType<InvoicesService["toInvoiceSummary"]>,
    filter: InvoiceOverdueFilter,
  ) {
    if (filter === InvoiceOverdueFilter.ALL) {
      return true;
    }
    return filter === InvoiceOverdueFilter.OVERDUE
      ? invoice.overdue
      : !invoice.overdue;
  }

  private invoiceInclude() {
    return {
      student: {
        include: {
          person: true,
          boardMemberships: {
            where: { status: BoardMembershipStatus.ACTIVE },
            take: 1,
          },
        },
      },
      enrollment: { include: this.enrollmentInclude() },
      createdBy: { select: { id: true, name: true, email: true } },
      cancelledBy: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.InvoiceInclude;
  }

  private enrollmentInclude() {
    return {
      academicYear: true,
      institution: true,
      shift: true,
    } satisfies Prisma.EnrollmentInclude;
  }

  private toInvoiceSummary(invoice: InvoiceWithRelations) {
    return {
      id: invoice.id,
      amountCents: invoice.amountCents,
      amountFormatted: formatInvoiceAmount(invoice.amountCents),
      dueDate: this.toDateOnly(invoice.dueDate),
      status: invoice.status,
      overdue: invoice.status === InvoiceStatus.OPEN && isInvoiceOverdue(invoice),
      description: invoice.description,
      cancelledAt: invoice.cancelledAt,
      cancellationReason: invoice.cancellationReason,
      cancellationNote: invoice.cancellationNote,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      student: this.toStudentPreview(invoice.student),
      enrollment: this.toEnrollment(invoice.enrollment),
      createdByUser: invoice.createdBy,
      cancelledByUser: invoice.cancelledBy,
    };
  }

  private toStudentPreview(student: StudentWithPerson) {
    return {
      id: student.id,
      status: student.status,
      person: {
        id: student.person.id,
        fullName: student.person.fullName,
        cpfMasked: maskCpf(student.person.cpf),
      },
      activeBoardMembership: student.boardMemberships[0] ?? null,
    };
  }

  private toEnrollment(enrollment: EnrollmentWithRelations) {
    return {
      id: enrollment.id,
      status: enrollment.status,
      course: enrollment.course,
      grade: enrollment.grade,
      academicYear: enrollment.academicYear,
      institution: enrollment.institution,
      shift: enrollment.shift,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    };
  }

  private async ensureStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }
  }

  private async lockStudent(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM students WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("Academico nao encontrado");
    }
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

  private async recordAuditTx(
    tx: Prisma.TransactionClient,
    input: {
      eventType: AdministrativeAuditEventType;
      domain: string;
      recordId: string;
      userId: string;
      metadata: Record<string, string | number | boolean>;
    },
  ) {
    await tx.administrativeAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        domain: input.domain,
        recordId: input.recordId,
        metadata: input.metadata,
      },
    });
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  private optional(value?: string) {
    return value && value.length > 0 ? value : undefined;
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: ReturnType<InvoicesService["invoiceInclude"]>;
}>;

type StudentWithPerson = {
  id: string;
  status: Prisma.StudentGetPayload<object>["status"];
  person: { id: string; fullName: string; cpf: string };
  boardMemberships: Prisma.BoardMembershipGetPayload<object>[];
};

type EnrollmentWithRelations = Prisma.EnrollmentGetPayload<{
  include: ReturnType<InvoicesService["enrollmentInclude"]>;
}>;
