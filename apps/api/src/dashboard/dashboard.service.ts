import { Inject, Injectable } from "@nestjs/common";
import {
  AcademicYearStatus,
  BankSlipStatus,
  EnrollmentStatus,
  Prisma,
  PreRegistrationStatus,
  RecordStatus,
  StudentCardStatus,
  StudentDocumentStatus,
  StudentStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { DOCUMENT_TYPES } from "../documents/document-file.js";
import { CollectionsService } from "../finance/collections.service.js";
import {
  CollectionAgingBucket,
  CollectionFiltersDto,
  ListCollectionCasesDto,
} from "../finance/dto/collections.dto.js";
import type { AuthUser } from "../users/users.service.js";
import type {
  DashboardChart,
  DashboardListItem,
  DashboardMetric,
  DashboardOverviewResponse,
  DashboardQuickShortcut,
} from "./dto/dashboard.dto.js";
import type { DashboardOverviewQueryDto } from "./dto/dashboard.dto.js";

// Mirrors DocumentsService.listStudentDocuments missingTypes; update document-file.ts
// when the official expected student document set changes.
const EXPECTED_STUDENT_DOCUMENT_TYPES = DOCUMENT_TYPES;

const BANK_SLIP_ATTENTION_STATUSES = [
  BankSlipStatus.ISSUE_FAILED,
  BankSlipStatus.CANCELLATION_FAILED,
  BankSlipStatus.UNKNOWN,
  BankSlipStatus.PENDING_CANCELLATION,
] as const;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CollectionsService) private readonly collections: CollectionsService,
  ) {}

  async getOverview(
    query: DashboardOverviewQueryDto,
    currentUser: AuthUser,
  ): Promise<DashboardOverviewResponse> {
    const generatedAt = new Date().toISOString();
    const today = this.utcDateOnly(new Date());
    const academicYear = await this.resolveAcademicYear(query.academicYearId);
    const academicYearId = query.academicYearId ?? academicYear?.id;
    const institutionIds = this.institutionIds(query, currentUser);
    const collectionFilters = this.collectionFilters(academicYearId, query);

    const enrollmentWhere = this.enrollmentWhere(academicYearId, institutionIds);
    const studentWhere = this.studentWhere(enrollmentWhere);
    const invoiceEnrollmentWhere = this.invoiceEnrollmentWhere(
      academicYearId,
      institutionIds,
    );
    const preRegistrationWhere = this.preRegistrationWhere(
      academicYearId,
      institutionIds,
    );

    const [
      collectionsSummary,
      collectionCases,
      collectionFollowUps,
      activeStudents,
      studentStatusCounts,
      pendingPreRegistrations,
      preRegistrationStatusCounts,
      recentPreRegistrations,
      bankSlipsAttention,
      bankSlipAttentionItems,
      activeBusAggregate,
      activeAssignmentsByBus,
      activeBuses,
      pendingCards,
      pendingCardItems,
      documentSnapshot,
      studentsByInstitution,
      preRegistrationsByMonth,
    ] = await Promise.all([
      this.collections.getSummary(collectionFilters, currentUser),
      this.collections.listCases(
        {
          ...collectionFilters,
          page: 1,
          limit: 20,
        } as ListCollectionCasesDto,
        { page: 1, limit: 20 },
        currentUser,
      ),
      this.collections.listFollowUps(
        {
          ...collectionFilters,
          followUpFrom: this.toDateOnly(today),
          followUpTo: this.toDateOnly(today),
        },
        currentUser,
      ),
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.student.groupBy({
        by: ["status"],
        where: this.studentWhere(enrollmentWhere, false),
        _count: { _all: true },
      }),
      this.prisma.publicPreRegistration.count({
        where: { ...preRegistrationWhere, status: PreRegistrationStatus.PENDING },
      }),
      this.prisma.publicPreRegistration.groupBy({
        by: ["status"],
        where: preRegistrationWhere,
        _count: { _all: true },
      }),
      this.prisma.publicPreRegistration.findMany({
        where: { ...preRegistrationWhere, status: PreRegistrationStatus.PENDING },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 5,
        select: {
          id: true,
          publicCode: true,
          fullName: true,
          createdAt: true,
          institution: { select: { name: true } },
        },
      }),
      this.prisma.bankSlip.count({
        where: {
          status: { in: [...BANK_SLIP_ATTENTION_STATUSES] },
          invoice: { enrollment: invoiceEnrollmentWhere },
        },
      }),
      this.prisma.bankSlip.findMany({
        where: {
          status: { in: [...BANK_SLIP_ATTENTION_STATUSES] },
          invoice: { enrollment: invoiceEnrollmentWhere },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 5,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          invoice: {
            select: {
              id: true,
              amountCents: true,
              dueDate: true,
              student: { select: { person: { select: { fullName: true } } } },
              enrollment: {
                select: { institution: { select: { name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.bus.aggregate({
        where: { status: RecordStatus.ACTIVE },
        _count: { _all: true },
        _sum: { capacity: true },
      }),
      this.prisma.busAssignment.groupBy({
        by: ["busId"],
        where: {
          status: "ACTIVE",
          enrollment: invoiceEnrollmentWhere,
        },
        _count: { _all: true },
      }),
      this.prisma.bus.findMany({
        where: { status: RecordStatus.ACTIVE },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, capacity: true },
      }),
      this.prisma.enrollment.count({
        where: this.pendingCardEnrollmentWhere(enrollmentWhere),
      }),
      this.prisma.enrollment.findMany({
        where: this.pendingCardEnrollmentWhere(enrollmentWhere),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 5,
        select: {
          id: true,
          createdAt: true,
          student: { select: { id: true, person: { select: { fullName: true } } } },
          institution: { select: { name: true } },
          academicYear: { select: { year: true } },
        },
      }),
      this.documentSnapshot(studentWhere),
      this.studentsByInstitution(enrollmentWhere),
      this.preRegistrationsByMonth(preRegistrationWhere),
    ]);

    const busCapacity = activeBusAggregate._sum.capacity ?? 0;
    const occupiedSeats = activeAssignmentsByBus.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const availableSeats = Math.max(busCapacity - occupiedSeats, 0);
    const busAttention = this.busAttentionItems(activeBuses, activeAssignmentsByBus);
    const criticalCases = collectionCases.data
      .filter((item) => item.priority !== "NORMAL")
      .slice(0, 5)
      .map((item) =>
        this.listItem({
          id: item.invoiceId,
          label: item.student.person.fullName,
          description: `${item.enrollment.institution.name} - ${item.daysOverdue} dia(s) vencido(s)`,
          status: item.priority,
          date: item.dueDate,
          amountCents: item.outstandingAmountCents,
        }),
      );
    const followUpsToday = collectionFollowUps.data.slice(0, 5).map((item) =>
      this.listItem({
        id: item.invoiceId,
        label: item.student.person.fullName,
        description: item.enrollment.institution.name,
        status: item.operationalStatus,
        date: item.nextFollowUpAt ? new Date(item.nextFollowUpAt).toISOString() : null,
        amountCents: item.outstandingAmountCents,
      }),
    );
    const pendingPreRegistrationItems = recentPreRegistrations.map((item) =>
      this.listItem({
        id: item.id,
        label: item.fullName,
        description: item.institution.name,
        status: PreRegistrationStatus.PENDING,
        date: item.createdAt.toISOString(),
        metadata: { publicCode: item.publicCode },
      }),
    );
    const pendingCardListItems = pendingCardItems.map((item) =>
      this.listItem({
        id: item.id,
        label: item.student.person.fullName,
        description: `${item.institution.name} - ${item.academicYear.year}`,
        status: "PENDING",
        date: item.createdAt.toISOString(),
        metadata: { studentId: item.student.id },
      }),
    );
    const bankSlipAlerts = bankSlipAttentionItems.map((item) =>
      this.listItem({
        id: item.id,
        label: item.invoice.student.person.fullName,
        description: item.invoice.enrollment.institution.name,
        status: item.status,
        date: item.updatedAt.toISOString(),
        amountCents: item.invoice.amountCents,
        metadata: { invoiceId: item.invoice.id },
      }),
    );

    const activeStudentsMetric = this.metric(
      "activeStudents",
      "Academicos ativos",
      activeStudents,
      this.formatInteger(activeStudents),
      academicYearId ? "Filtro por ano letivo aplicado" : "Todos os anos letivos",
      activeStudents > 0 ? "success" : "neutral",
    );
    const pendingPreRegistrationsMetric = this.metric(
      "pendingPreRegistrations",
      "Pre-cadastros pendentes",
      pendingPreRegistrations,
      this.formatInteger(pendingPreRegistrations),
      "Aguardando revisao",
      pendingPreRegistrations > 0 ? "warning" : "success",
    );
    const overdueAmountMetric = this.metric(
      "overdueAmount",
      "Valor vencido",
      collectionsSummary.totalOverdueCents,
      this.formatCents(collectionsSummary.totalOverdueCents),
      `${collectionsSummary.invoiceCount} fatura(s) vencida(s)`,
      collectionsSummary.totalOverdueCents > 0 ? "danger" : "success",
    );
    const overdueInvoicesMetric = this.metric(
      "overdueInvoices",
      "Faturas vencidas",
      collectionsSummary.invoiceCount,
      this.formatInteger(collectionsSummary.invoiceCount),
      `${collectionsSummary.studentCount} academico(s) inadimplente(s)`,
      collectionsSummary.invoiceCount > 0 ? "danger" : "success",
    );
    const bankSlipsAttentionMetric = this.metric(
      "bankSlipsAttention",
      "Boletos em atencao",
      bankSlipsAttention,
      this.formatInteger(bankSlipsAttention),
      "Falha, status desconhecido ou cancelamento pendente",
      bankSlipsAttention > 0 ? "warning" : "success",
    );
    const busSeatsMetric = this.metric(
      "busSeats",
      "Vagas ocupadas",
      occupiedSeats,
      `${this.formatInteger(occupiedSeats)}/${this.formatInteger(busCapacity)}`,
      `${this.formatInteger(availableSeats)} vaga(s) disponivel(is)`,
      availableSeats <= 0 && busCapacity > 0 ? "danger" : "neutral",
    );
    const pendingStudentCardsMetric = this.metric(
      "pendingStudentCards",
      "Carteirinhas pendentes",
      pendingCards,
      this.formatInteger(pendingCards),
      "Matriculas ativas sem carteirinha ativa",
      pendingCards > 0 ? "warning" : "success",
    );
    const documentsAttentionMetric = this.metric(
      "incompleteDocuments",
      "Cadastros com documentacao incompleta",
      documentSnapshot.missingCount,
      this.formatInteger(documentSnapshot.missingCount),
      "Academicos ativos sem todos os documentos esperados",
      documentSnapshot.missingCount > 0 ? "warning" : "success",
    );

    return {
      generatedAt,
      academicYear: academicYear
        ? {
            id: academicYear.id,
            year: academicYear.year,
            isCurrent: academicYear.isCurrent,
          }
        : null,
      indicators: {
        activeStudents: activeStudentsMetric,
        pendingPreRegistrations: pendingPreRegistrationsMetric,
        overdueAmount: overdueAmountMetric,
        overdueInvoices: overdueInvoicesMetric,
        bankSlipsAttention: bankSlipsAttentionMetric,
        busSeats: busSeatsMetric,
        pendingStudentCards: pendingStudentCardsMetric,
        incompleteDocuments: documentsAttentionMetric,
      },
      agendaToday: {
        collectionFollowUps: followUpsToday,
        preRegistrationsToReview: pendingPreRegistrationItems,
        pendingCards: pendingCardListItems,
      },
      criticalAlerts: [
        ...this.collectionAlerts(collectionsSummary),
        ...bankSlipAlerts,
        ...busAttention.slice(0, 3),
        ...documentSnapshot.items.slice(0, 3),
      ].slice(0, 10),
      financeAndCollections: {
        metrics: [
          overdueAmountMetric,
          overdueInvoicesMetric,
          this.metric(
            "averageOverdueAmount",
            "Ticket medio vencido",
            collectionsSummary.averageOverdueAmountCents,
            this.formatCents(collectionsSummary.averageOverdueAmountCents),
            null,
            "neutral",
          ),
          this.metric(
            "followUpsToday",
            "Retornos hoje",
            collectionsSummary.followUpsTodayCount,
            this.formatInteger(collectionsSummary.followUpsTodayCount),
            null,
            collectionsSummary.followUpsTodayCount > 0 ? "warning" : "success",
          ),
        ],
        criticalCases,
      },
      academicsAndDocuments: {
        metrics: [
          activeStudentsMetric,
          this.metric(
            "suspendedStudents",
            "Academicos suspensos",
            this.statusCount(studentStatusCounts, StudentStatus.SUSPENDED),
            this.formatInteger(
              this.statusCount(studentStatusCounts, StudentStatus.SUSPENDED),
            ),
            null,
            "warning",
          ),
          this.metric(
            "terminatedStudents",
            "Academicos encerrados",
            this.statusCount(studentStatusCounts, StudentStatus.TERMINATED),
            this.formatInteger(
              this.statusCount(studentStatusCounts, StudentStatus.TERMINATED),
            ),
            null,
            "neutral",
          ),
          documentsAttentionMetric,
        ],
        recentItems: documentSnapshot.items,
      },
      busesAndSeats: {
        metrics: [
          this.metric(
            "activeBuses",
            "Onibus ativos",
            activeBusAggregate._count._all,
            this.formatInteger(activeBusAggregate._count._all),
            null,
            "neutral",
          ),
          busSeatsMetric,
          this.metric(
            "availableSeats",
            "Vagas disponiveis",
            availableSeats,
            this.formatInteger(availableSeats),
            null,
            availableSeats > 0 ? "success" : "danger",
          ),
        ],
        attentionBuses: busAttention,
      },
      preRegistrations: {
        metrics: [
          pendingPreRegistrationsMetric,
          this.metric(
            "approvedPreRegistrations",
            "Pre-cadastros aprovados",
            this.statusCount(
              preRegistrationStatusCounts,
              PreRegistrationStatus.APPROVED,
            ),
            this.formatInteger(
              this.statusCount(
                preRegistrationStatusCounts,
                PreRegistrationStatus.APPROVED,
              ),
            ),
            null,
            "success",
          ),
          this.metric(
            "rejectedPreRegistrations",
            "Pre-cadastros rejeitados",
            this.statusCount(
              preRegistrationStatusCounts,
              PreRegistrationStatus.REJECTED,
            ),
            this.formatInteger(
              this.statusCount(
                preRegistrationStatusCounts,
                PreRegistrationStatus.REJECTED,
              ),
            ),
            null,
            "neutral",
          ),
        ],
        pendingItems: pendingPreRegistrationItems,
      },
      pendingStudentCards: {
        metrics: [pendingStudentCardsMetric],
        items: pendingCardListItems,
      },
      charts: {
        overdueByAgingBucket: this.overdueByAgingBucketChart(
          collectionsSummary.agingBuckets,
        ),
        occupancyByBus: this.occupancyByBusChart(
          activeBuses,
          activeAssignmentsByBus,
        ),
        studentsByInstitution,
        preRegistrationsByMonth,
      },
      quickShortcuts: this.quickShortcuts(),
    };
  }

  private async resolveAcademicYear(academicYearId?: string) {
    if (academicYearId) {
      return this.prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true, year: true, isCurrent: true },
      });
    }
    return this.prisma.academicYear.findFirst({
      where: { isCurrent: true, status: AcademicYearStatus.ACTIVE },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
      select: { id: true, year: true, isCurrent: true },
    });
  }

  private institutionIds(query: DashboardOverviewQueryDto, currentUser: AuthUser) {
    const scopedIds =
      currentUser.institutionIds ??
      (currentUser.institutionId ? [currentUser.institutionId] : null);
    if (query.institutionId) {
      return [query.institutionId];
    }
    return scopedIds ?? undefined;
  }

  private collectionFilters(
    academicYearId: string | undefined,
    query: DashboardOverviewQueryDto,
  ): CollectionFiltersDto {
    return {
      academicYearId,
      institutionId: query.institutionId,
    };
  }

  private enrollmentWhere(
    academicYearId: string | undefined,
    institutionIds: string[] | undefined,
  ): Prisma.EnrollmentWhereInput {
    return {
      status: EnrollmentStatus.ACTIVE,
      ...(academicYearId ? { academicYearId } : {}),
      ...(institutionIds
        ? {
            institutionId:
              institutionIds.length === 1 ? institutionIds[0] : { in: institutionIds },
          }
        : {}),
    };
  }

  private invoiceEnrollmentWhere(
    academicYearId: string | undefined,
    institutionIds: string[] | undefined,
  ): Prisma.EnrollmentWhereInput {
    return this.enrollmentWhere(academicYearId, institutionIds);
  }

  private studentWhere(
    enrollmentWhere: Prisma.EnrollmentWhereInput,
    activeOnly = true,
  ): Prisma.StudentWhereInput {
    return {
      ...(activeOnly ? { status: StudentStatus.ACTIVE } : {}),
      enrollments: { some: enrollmentWhere },
    };
  }

  private preRegistrationWhere(
    academicYearId: string | undefined,
    institutionIds: string[] | undefined,
  ): Prisma.PublicPreRegistrationWhereInput {
    return {
      ...(academicYearId ? { academicYearId } : {}),
      ...(institutionIds
        ? {
            institutionId:
              institutionIds.length === 1 ? institutionIds[0] : { in: institutionIds },
          }
        : {}),
    };
  }

  private pendingCardEnrollmentWhere(
    enrollmentWhere: Prisma.EnrollmentWhereInput,
  ): Prisma.EnrollmentWhereInput {
    return {
      ...enrollmentWhere,
      student: { status: StudentStatus.ACTIVE },
      studentCards: { none: { status: StudentCardStatus.ACTIVE } },
    };
  }

  private async documentSnapshot(studentWhere: Prisma.StudentWhereInput) {
    const students = await this.prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        person: { select: { fullName: true } },
        documents: {
          where: { status: StudentDocumentStatus.ACTIVE },
          select: { documentType: true },
        },
        enrollments: {
          take: 1,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            institution: { select: { name: true } },
            academicYear: { select: { year: true } },
          },
        },
      },
    });

    const missing = students
      .map((student) => {
        const presentTypes = new Set(
          student.documents.map((document) => document.documentType),
        );
        const missingTypes = EXPECTED_STUDENT_DOCUMENT_TYPES.filter(
          (type) => !presentTypes.has(type),
        );
        return { student, missingTypes };
      })
      .filter((item) => item.missingTypes.length > 0);

    return {
      missingCount: missing.length,
      items: missing.slice(0, 5).map(({ student, missingTypes }) =>
        this.listItem({
          id: student.id,
          label: student.person.fullName,
          description:
            student.enrollments[0]?.institution.name ??
            "Instituicao nao informada",
          status: "DOCUMENTS_PENDING",
          date: null,
          metadata: {
            missingCount: missingTypes.length,
            academicYear: student.enrollments[0]?.academicYear.year ?? null,
          },
        }),
      ),
    };
  }

  private async studentsByInstitution(
    enrollmentWhere: Prisma.EnrollmentWhereInput,
  ): Promise<DashboardChart> {
    const grouped = await this.prisma.enrollment.groupBy({
      by: ["institutionId"],
      where: {
        ...enrollmentWhere,
        student: { status: StudentStatus.ACTIVE },
      },
      _count: { _all: true },
      orderBy: { _count: { institutionId: "desc" } },
      take: 8,
    });
    const institutions = await this.prisma.institution.findMany({
      where: { id: { in: grouped.map((item) => item.institutionId) } },
      select: { id: true, name: true },
    });
    const names = new Map(institutions.map((item) => [item.id, item.name]));

    return {
      key: "studentsByInstitution",
      title: "Academicos por instituicao",
      description: "Academicos ativos agrupados por instituicao",
      type: "bar",
      data: grouped.map((item) => ({
        label: names.get(item.institutionId) ?? "Instituicao",
        value: item._count._all,
      })),
    };
  }

  private async preRegistrationsByMonth(
    where: Prisma.PublicPreRegistrationWhereInput,
  ): Promise<DashboardChart> {
    const months = this.lastMonths(6);
    const records = await this.prisma.publicPreRegistration.findMany({
      where: {
        ...where,
        createdAt: { gte: months[0]?.from },
      },
      select: { createdAt: true },
    });
    const counts = new Map(months.map((month) => [month.key, 0]));
    for (const record of records) {
      const key = this.monthKey(record.createdAt);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return {
      key: "preRegistrationsByMonth",
      title: "Pre-cadastros por mes",
      description: "Entrada mensal de pre-cadastros",
      type: "line",
      data: months.map((month) => ({
        label: month.label,
        value: counts.get(month.key) ?? 0,
      })),
    };
  }

  private overdueByAgingBucketChart(
    buckets: Record<CollectionAgingBucket, number>,
  ): DashboardChart {
    return {
      key: "overdueByAgingBucket",
      title: "Inadimplencia por faixa",
      description: "Faturas vencidas agrupadas por idade da divida",
      type: "bar",
      data: [
        { label: "1-30 dias", value: buckets.DAYS_1_30 ?? 0 },
        { label: "31-60 dias", value: buckets.DAYS_31_60 ?? 0 },
        { label: "61-90 dias", value: buckets.DAYS_61_90 ?? 0 },
        { label: "90+ dias", value: buckets.DAYS_90_PLUS ?? 0 },
      ],
    };
  }

  private occupancyByBusChart(
    buses: Array<{ id: string; name: string; capacity: number }>,
    assignments: Array<{ busId: string; _count: { _all: number } }>,
  ): DashboardChart {
    const occupiedByBus = new Map(
      assignments.map((item) => [item.busId, item._count._all]),
    );

    return {
      key: "occupancyByBus",
      title: "Ocupacao por onibus",
      description: "Capacidade, vagas ocupadas e vagas livres por onibus ativo",
      type: "bar",
      data: buses.map((bus) => {
        const occupiedSeats = occupiedByBus.get(bus.id) ?? 0;
        const availableSeats = Math.max(bus.capacity - occupiedSeats, 0);
        const occupancyPercent =
          bus.capacity > 0 ? Math.round((occupiedSeats / bus.capacity) * 100) : 0;
        const status =
          availableSeats <= 0
            ? "FULL"
            : occupancyPercent >= 90
              ? "NEAR_FULL"
              : "NORMAL";
        return {
          busId: bus.id,
          label: bus.name,
          value: occupancyPercent,
          capacity: bus.capacity,
          occupiedSeats,
          availableSeats,
          occupancyPercent,
          status,
        };
      }),
    };
  }

  private busAttentionItems(
    buses: Array<{ id: string; name: string; capacity: number }>,
    assignments: Array<{ busId: string; _count: { _all: number } }>,
  ) {
    const occupiedByBus = new Map(
      assignments.map((item) => [item.busId, item._count._all]),
    );
    return buses
      .map((bus) => {
        const occupied = occupiedByBus.get(bus.id) ?? 0;
        const available = Math.max(bus.capacity - occupied, 0);
        const occupancyRate = bus.capacity > 0 ? occupied / bus.capacity : 0;
        return { bus, occupied, available, occupancyRate };
      })
      .filter((item) => item.available <= 0 || item.occupancyRate >= 0.9)
      .sort(
        (left, right) =>
          right.occupancyRate - left.occupancyRate ||
          left.bus.name.localeCompare(right.bus.name),
      )
      .slice(0, 5)
      .map((item) =>
        this.listItem({
          id: item.bus.id,
          label: item.bus.name,
          description: `${item.occupied}/${item.bus.capacity} vaga(s) ocupada(s)`,
          status: item.available <= 0 ? "FULL" : "NEAR_FULL",
          date: null,
          metadata: {
            occupiedSeats: item.occupied,
            capacity: item.bus.capacity,
            availableSeats: item.available,
          },
        }),
      );
  }

  private collectionAlerts(summary: {
    promisesBrokenCount: number;
    partialPaymentReviewCount: number;
    followUpsTodayCount: number;
  }): DashboardListItem[] {
    const alerts: DashboardListItem[] = [];
    if (summary.promisesBrokenCount > 0) {
      alerts.push(
        this.listItem({
          id: "collection-promises-broken",
          label: "Promessas quebradas",
          description: `${summary.promisesBrokenCount} promessa(s) vencida(s)`,
          status: "PROMISE_BROKEN",
          date: null,
        }),
      );
    }
    if (summary.partialPaymentReviewCount > 0) {
      alerts.push(
        this.listItem({
          id: "collection-partial-review",
          label: "Pagamentos parciais para revisao",
          description: `${summary.partialPaymentReviewCount} caso(s) aguardando revisao`,
          status: "PARTIAL_PAYMENT_REVIEW",
          date: null,
        }),
      );
    }
    if (summary.followUpsTodayCount > 0) {
      alerts.push(
        this.listItem({
          id: "collection-follow-ups-today",
          label: "Retornos de cobranca hoje",
          description: `${summary.followUpsTodayCount} retorno(s) previsto(s)`,
          status: "FOLLOW_UP_TODAY",
          date: null,
        }),
      );
    }
    return alerts;
  }

  private statusCount<T extends string>(
    rows: Array<{ status: T; _count: { _all: number } }>,
    status: T,
  ) {
    return rows.find((row) => row.status === status)?._count._all ?? 0;
  }

  private metric(
    key: string,
    label: string,
    value: number,
    formattedValue: string,
    context: string | null,
    status: DashboardMetric["status"] = "neutral",
  ): DashboardMetric {
    return { key, label, value, formattedValue, context, status };
  }

  private listItem(input: DashboardListItem): DashboardListItem {
    return input;
  }

  private quickShortcuts(): DashboardQuickShortcut[] {
    return [
      { key: "students", label: "Academicos", href: "/admin?area=students" },
      {
        key: "pre-registrations",
        label: "Pre-cadastros",
        href: "/admin?area=pre-registrations",
      },
      { key: "finance", label: "Financeiro", href: "/admin?area=finance" },
      {
        key: "collections",
        label: "Cobranca",
        href: "/admin?area=finance&financeArea=collections",
      },
      {
        key: "student-cards",
        label: "Carteirinhas",
        href: "/admin?area=student-cards",
      },
      { key: "buses", label: "Onibus e vagas", href: "/admin?area=base" },
    ];
  }

  private formatInteger(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatCents(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  }

  private utcDateOnly(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private lastMonths(count: number) {
    const now = new Date();
    const months: Array<{ key: string; label: string; from: Date }> = [];
    for (let index = count - 1; index >= 0; index -= 1) {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      months.push({
        key: this.monthKey(from),
        label: `${String(from.getUTCMonth() + 1).padStart(2, "0")}/${from.getUTCFullYear()}`,
        from,
      });
    }
    return months;
  }

  private monthKey(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}
