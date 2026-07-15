import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  AcademicYearStatus,
  BoardMembershipStatus,
  Prisma,
  StudentCardInvalidationReason,
  StudentCardStatus,
  StudentCardType,
  StudentHistoryEventType,
  StudentStatus,
} from "@prisma/client";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { resolvePagination } from "../common/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import { maskCpf, normalizeCpf } from "../students/cpf.js";
import { buildStudentCardNumber } from "./card-number.js";
import {
  InvalidateStudentCardDto,
  IssueStudentCardDto,
  ListStudentCardsDto,
  SortOrder,
  StudentCardPreviewDto,
  StudentCardSort,
  StudentCardValidityFilter,
} from "./dto/student-cards.dto.js";

type PrismaTx = Prisma.TransactionClient | PrismaService;

export function buildStudentCardValidityWhere(
  filter: StudentCardValidityFilter,
): Prisma.StudentCardWhereInput | null {
  if (filter === StudentCardValidityFilter.ALL) {
    return null;
  }
  const usableWhere: Prisma.StudentCardWhereInput = {
    status: { not: StudentCardStatus.INVALIDATED },
    student: {
      status: { notIn: [StudentStatus.SUSPENDED, StudentStatus.TERMINATED] },
    },
    AND: [
      {
        OR: [
          { cardType: { not: StudentCardType.BOARD_MEMBER } },
          { boardMembership: { is: { status: BoardMembershipStatus.ACTIVE } } },
        ],
      },
      {
        OR: [
          { cardType: { not: StudentCardType.STUDENT } },
          {
            student: {
              boardMemberships: {
                none: { status: BoardMembershipStatus.ACTIVE },
              },
            },
          },
        ],
      },
    ],
  };
  return filter === StudentCardValidityFilter.USABLE
    ? usableWhere
    : { NOT: usableWhere };
}

function combineStudentCardWhere(
  base: Prisma.StudentCardWhereInput,
  derived: Prisma.StudentCardWhereInput | null,
): Prisma.StudentCardWhereInput {
  if (!derived) {
    return base;
  }
  if (Object.keys(base).length === 0) {
    return derived;
  }
  return { AND: [base, derived] };
}

@Injectable()
export class StudentCardsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  async listStudentCards(query: ListStudentCardsDto) {
    const where = combineStudentCardWhere(
      this.buildCardWhere(query),
      buildStudentCardValidityWhere(query.validity),
    );
    const pagination = this.resolvePagination(query);
    const orderBy = this.buildOrderBy(query);
    const [records, total] = await Promise.all([
      this.prisma.studentCard.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
        include: this.cardInclude(),
      }),
      this.prisma.studentCard.count({ where }),
    ]);
    const data = records.map((record) => this.toCardSummary(record));

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

  async listStudentCardsForStudent(studentId: string) {
    await this.ensureStudent(studentId);
    const records = await this.prisma.studentCard.findMany({
      where: { studentId },
      include: this.cardInclude(),
      orderBy: [{ academicYear: { year: "desc" } }, { issuedAt: "desc" }],
    });
    return { data: records.map((record) => this.toCardSummary(record)) };
  }

  async previewStudentCard(studentId: string, query: StudentCardPreviewDto) {
    const result = await this.evaluateEligibility(this.prisma, studentId, query);
    return {
      student: this.toStudentPreview(result.student),
      enrollment: this.toEnrollment(result.enrollment),
      academicYear: result.academicYear,
      cardType: query.cardType,
      activeBoardMembership: result.activeBoardMembership,
      previousCard: result.activeCard
        ? this.toCardSummary(result.activeCard)
        : result.latestCard
          ? this.toCardSummary(result.latestCard)
          : null,
      eligible: result.blockingReason === null,
      blockingReason: result.blockingReason,
    };
  }

  async issueStudentCard(
    studentId: string,
    body: IssueStudentCardDto,
    userId: string,
  ) {
    try {
      const created = await this.prisma.$transaction((tx) =>
        this.issueStudentCardTx(tx, studentId, body, userId),
      );
      return this.toCardSummary(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  issueAutomaticStudentCardTx(
    tx: Prisma.TransactionClient,
    input: {
      studentId: string;
      enrollmentId: string;
      userId: string;
      note?: string;
    },
  ) {
    return this.issueStudentCardTx(
      tx,
      input.studentId,
      {
        enrollmentId: input.enrollmentId,
        cardType: StudentCardType.STUDENT,
        note: input.note,
      },
      input.userId,
    );
  }

  async invalidateStudentCard(
    studentId: string,
    cardId: string,
    body: InvalidateStudentCardDto,
    userId: string,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockStudent(tx, studentId);
      const card = await this.lockStudentCard(tx, cardId);
      if (card.studentId !== studentId) {
        throw new NotFoundException("Carteirinha nao encontrada");
      }
      if (card.status !== StudentCardStatus.ACTIVE) {
        throw new BadRequestException("Carteirinha ja invalidada");
      }
      await this.invalidateCardTx(tx, {
        card,
        userId,
        reason: body.reason,
        note: this.optional(body.note),
      });
      const reloaded = await tx.studentCard.findUnique({
        where: { id: card.id },
        include: this.cardInclude(),
      });
      if (!reloaded) {
        throw new NotFoundException("Carteirinha nao encontrada");
      }
      return reloaded;
    });

    return this.toCardSummary(updated);
  }

  private async evaluateEligibility(
    tx: PrismaTx,
    studentId: string,
    input: StudentCardPreviewDto,
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

    const activeCard = await tx.studentCard.findFirst({
      where: {
        enrollmentId: enrollment.id,
        status: StudentCardStatus.ACTIVE,
      },
      include: this.cardInclude(),
    });
    const latestCard = await tx.studentCard.findFirst({
      where: { enrollmentId: enrollment.id },
      include: this.cardInclude(),
      orderBy: { issuedAt: "desc" },
    });
    const activeBoardMembership = student.boardMemberships[0] ?? null;

    let blockingReason: string | null = null;
    if (student.status === StudentStatus.SUSPENDED) {
      blockingReason = "Academico suspenso nao pode receber nova carteirinha";
    } else if (student.status === StudentStatus.TERMINATED) {
      blockingReason = "Academico desligado nao pode receber nova carteirinha";
    } else if (input.cardType === StudentCardType.STUDENT && activeBoardMembership) {
      blockingReason = "Academico com diretoria ativa deve receber carteirinha de diretoria";
    } else if (
      input.cardType === StudentCardType.BOARD_MEMBER &&
      !activeBoardMembership
    ) {
      blockingReason = "Carteirinha de diretoria exige diretoria ativa";
    } else if (
      input.cardType === StudentCardType.BOARD_MEMBER &&
      input.boardMembershipId &&
      input.boardMembershipId !== activeBoardMembership?.id
    ) {
      blockingReason = "Diretoria ativa informada nao pertence ao academico";
    } else if (
      activeCard &&
      !(
        input.cardType === StudentCardType.BOARD_MEMBER &&
        activeCard.cardType === StudentCardType.STUDENT
      )
    ) {
      blockingReason = "Matricula ja possui carteirinha ativa";
    } else if (enrollment.academicYear.status !== AcademicYearStatus.ACTIVE) {
      blockingReason = "ACADEMIC_YEAR_NOT_ACTIVE: Ano Letivo ativo obrigatorio";
    }

    return {
      student,
      enrollment,
      academicYear: enrollment.academicYear,
      activeBoardMembership,
      activeCard,
      latestCard,
      blockingReason,
    };
  }

  private async issueStudentCardTx(
    tx: Prisma.TransactionClient,
    studentId: string,
    body: IssueStudentCardDto,
    userId: string,
  ) {
    await this.lockStudent(tx, studentId);
    const eligibility = await this.evaluateEligibility(tx, studentId, body);
    if (eligibility.blockingReason) {
      throw new BadRequestException(eligibility.blockingReason);
    }

    if (
      body.cardType === StudentCardType.BOARD_MEMBER &&
      eligibility.activeCard?.cardType === StudentCardType.STUDENT
    ) {
      await this.invalidateCardTx(tx, {
        card: eligibility.activeCard,
        userId,
        reason: StudentCardInvalidationReason.SUPERSEDED_BY_BOARD_CARD,
        note: "Invalidada pela emissao de carteirinha de diretoria",
      });
    }

    const sequenceNumber = await this.nextSequenceNumber(
      tx,
      eligibility.academicYear.id,
      body.cardType,
    );
    const cardNumber = buildStudentCardNumber(
      sequenceNumber,
      eligibility.academicYear.year,
    );
    const card = await tx.studentCard.create({
      data: {
        studentId,
        enrollmentId: eligibility.enrollment.id,
        academicYearId: eligibility.academicYear.id,
        boardMembershipId:
          body.cardType === StudentCardType.BOARD_MEMBER
            ? eligibility.activeBoardMembership?.id
            : undefined,
        cardType: body.cardType,
        sequenceNumber,
        cardNumber,
        issuedByUserId: userId,
      },
      include: this.cardInclude(),
    });
    await tx.studentHistoryEvent.create({
      data: {
        studentId,
        eventType: StudentHistoryEventType.STUDENT_CARD_ISSUED,
        studentCardId: card.id,
        boardMembershipId: card.boardMembershipId,
        justification: this.optional(body.note),
        performedByUserId: userId,
      },
    });
    await this.recordAuditTx(tx, {
      eventType: AdministrativeAuditEventType.STUDENT_CARD_ISSUED,
      domain: "student_cards",
      recordId: card.id,
      userId,
      metadata: {
        studentId,
        enrollmentId: card.enrollmentId,
        academicYearId: card.academicYearId,
        studentCardId: card.id,
        cardType: card.cardType,
        sequenceNumber: card.sequenceNumber,
        cardNumber: card.cardNumber,
      },
    });

    return card;
  }

  private async nextSequenceNumber(
    tx: Prisma.TransactionClient,
    academicYearId: string,
    cardType: StudentCardType,
  ) {
    await tx.cardSequence.upsert({
      where: { academicYearId_cardType: { academicYearId, cardType } },
      create: { academicYearId, cardType, lastSequenceNumber: 0 },
      update: {},
    });
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM card_sequences
      WHERE academic_year_id = ${academicYearId}::uuid
        AND card_type = ${cardType}::"StudentCardType"
      FOR UPDATE
    `;
    const sequence = await tx.cardSequence.findUnique({
      where: { academicYearId_cardType: { academicYearId, cardType } },
    });
    if (!sequence) {
      throw new BadRequestException("Sequencia de carteirinha nao encontrada");
    }
    const lastSequenceNumber = sequence.lastSequenceNumber + 1;
    await tx.cardSequence.update({
      where: { id: sequence.id },
      data: { lastSequenceNumber },
    });
    return lastSequenceNumber;
  }

  private async invalidateCardTx(
    tx: Prisma.TransactionClient,
    input: {
      card: StudentCardWithRelations;
      userId: string;
      reason: StudentCardInvalidationReason;
      note?: string;
    },
  ) {
    const invalidated = await tx.studentCard.update({
      where: { id: input.card.id },
      data: {
        status: StudentCardStatus.INVALIDATED,
        invalidatedAt: new Date(),
        invalidationReason: input.reason,
        invalidationNote: input.note,
        invalidatedByUserId: input.userId,
      },
    });
    await tx.studentHistoryEvent.create({
      data: {
        studentId: invalidated.studentId,
        eventType: StudentHistoryEventType.STUDENT_CARD_INVALIDATED,
        studentCardId: invalidated.id,
        boardMembershipId: invalidated.boardMembershipId,
        justification: input.note,
        performedByUserId: input.userId,
      },
    });
    await this.recordAuditTx(tx, {
      eventType: AdministrativeAuditEventType.STUDENT_CARD_INVALIDATED,
      domain: "student_cards",
      recordId: invalidated.id,
      userId: input.userId,
      metadata: {
        studentId: invalidated.studentId,
        enrollmentId: invalidated.enrollmentId,
        academicYearId: invalidated.academicYearId,
        studentCardId: invalidated.id,
        cardType: invalidated.cardType,
        sequenceNumber: invalidated.sequenceNumber,
        cardNumber: invalidated.cardNumber,
        reason: input.reason,
      },
    });
  }

  private buildCardWhere(query: ListStudentCardsDto): Prisma.StudentCardWhereInput {
    const where: Prisma.StudentCardWhereInput = {};
    if (query.academicYearId) {
      where.academicYearId = query.academicYearId;
    }
    if (query.cardType) {
      where.cardType = query.cardType;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      const normalizedSearch = this.normalizeName(query.search);
      const cpfSearch = normalizeCpf(query.search);
      where.OR = [
        { cardNumber: { contains: query.search.trim() } },
        { student: { person: { normalizedName: { contains: normalizedSearch } } } },
        ...(cpfSearch
          ? [{ student: { person: { cpf: { contains: cpfSearch } } } }]
          : []),
      ];
    }
    return where;
  }

  private buildOrderBy(
    query: ListStudentCardsDto,
  ): Prisma.StudentCardOrderByWithRelationInput[] {
    const direction = query.order === SortOrder.ASC ? "asc" : "desc";
    if (query.sort === StudentCardSort.CARD_NUMBER) {
      return [{ sequenceNumber: direction }, { issuedAt: "desc" }, { id: "asc" }];
    }
    return [{ issuedAt: direction }, { sequenceNumber: "desc" }, { id: "asc" }];
  }

  private resolvePagination(query: ListStudentCardsDto) {
    return resolvePagination(query);
  }

  private deriveValidity(card: StudentCardWithRelations) {
    if (card.status === StudentCardStatus.INVALIDATED) {
      return { usable: false, reason: "CARD_INVALIDATED" };
    }
    if (card.student.status === StudentStatus.SUSPENDED) {
      return { usable: false, reason: "STUDENT_SUSPENDED" };
    }
    if (card.student.status === StudentStatus.TERMINATED) {
      return { usable: false, reason: "STUDENT_TERMINATED" };
    }
    if (
      card.cardType === StudentCardType.BOARD_MEMBER &&
      card.boardMembership?.status !== BoardMembershipStatus.ACTIVE
    ) {
      return { usable: false, reason: "BOARD_MEMBERSHIP_ENDED" };
    }
    if (
      card.cardType === StudentCardType.STUDENT &&
      card.student.boardMemberships.some(
        (membership) => membership.status === BoardMembershipStatus.ACTIVE,
      )
    ) {
      return {
        usable: false,
        reason: "BOARD_MEMBERSHIP_ACTIVE_REQUIRES_BOARD_CARD",
      };
    }
    return { usable: true, reason: null };
  }

  private cardInclude() {
    return {
      student: {
        include: {
          person: true,
          boardMemberships: {
            where: { status: BoardMembershipStatus.ACTIVE },
          },
        },
      },
      enrollment: { include: this.enrollmentInclude() },
      academicYear: true,
      boardMembership: true,
      issuedBy: { select: { id: true, name: true, email: true } },
      invalidatedBy: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.StudentCardInclude;
  }

  private enrollmentInclude() {
    return {
      academicYear: true,
      institution: true,
      shift: true,
    } satisfies Prisma.EnrollmentInclude;
  }

  private toCardSummary(card: StudentCardWithRelations) {
    return {
      id: card.id,
      cardType: card.cardType,
      sequenceNumber: card.sequenceNumber,
      cardNumber: card.cardNumber,
      status: card.status,
      issuedAt: card.issuedAt,
      invalidatedAt: card.invalidatedAt,
      invalidationReason: card.invalidationReason,
      invalidationNote: card.invalidationNote,
      validity: this.deriveValidity(card),
      student: this.toStudentPreview(card.student),
      enrollment: this.toEnrollment(card.enrollment),
      academicYear: card.academicYear,
      boardMembership: card.boardMembership,
      issuedByUser: card.issuedBy,
      invalidatedByUser: card.invalidatedBy,
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

  private async lockStudentCard(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM student_cards WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("Carteirinha nao encontrada");
    }
    const card = await tx.studentCard.findUnique({
      where: { id },
      include: this.cardInclude(),
    });
    if (!card) {
      throw new NotFoundException("Carteirinha nao encontrada");
    }
    return card;
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

  private handleWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Carteirinha duplicada ou sequencia ja utilizada");
    }
    throw error;
  }
}

type StudentCardWithRelations = Prisma.StudentCardGetPayload<{
  include: ReturnType<StudentCardsService["cardInclude"]>;
}>;

type StudentWithPerson = {
  id: string;
  status: StudentStatus;
  person: { id: string; fullName: string; cpf: string };
  boardMemberships: Prisma.BoardMembershipGetPayload<object>[];
};

type EnrollmentWithRelations = Prisma.EnrollmentGetPayload<{
  include: ReturnType<StudentCardsService["enrollmentInclude"]>;
}>;
