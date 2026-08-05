import { Inject, Injectable } from "@nestjs/common";
import {
  AcademicYearStatus,
  BankSlipStatus,
  EnrollmentStatus,
  InvoiceStatus,
  Prisma,
  PreRegistrationStatus,
  RecordStatus,
  StudentDocumentStatus,
  StudentStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import { scopedInstitutionFilter } from "../auth/institution-scope.js";
import { DOCUMENT_TYPES } from "../documents/document-file.js";
import { CollectionsService } from "../finance/collections.service.js";
import {
  CollectionAgingBucket,
  CollectionFiltersDto,
  ListCollectionCasesDto,
} from "../finance/dto/collections.dto.js";
import { buildPendingCardEnrollmentWhere } from "../student-cards/pending-card.js";
import type { AuthUser } from "../users/users.service.js";
import type {
  DashboardChart,
  DashboardListItem,
  DashboardMetric,
  DashboardOperationalBlock,
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

const BANK_SLIP_ERROR_STATUSES = [
  BankSlipStatus.ISSUE_FAILED,
  BankSlipStatus.CANCELLATION_FAILED,
  BankSlipStatus.UNKNOWN,
] as const;

type DashboardPart<T> = {
  data: T;
  error: string | null;
  ok: boolean;
};

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
    const monthStart = this.startOfUtcMonth(today);
    const nextMonthStart = this.startOfNextUtcMonth(today);
    const academicYear = await this.resolveAcademicYear(query.academicYearId);
    const academicYearId = query.academicYearId ?? academicYear?.id;
    const institutionIds = this.institutionIds(query, currentUser);
    const collectionFilters = this.collectionFilters(academicYearId, query);
    const href = (params: Record<string, string | undefined>) =>
      this.dashboardHref(params, academicYearId, query.institutionId);

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
    const paidThisMonthWhere = this.paidThisMonthWhere(
      institutionIds,
      monthStart,
      nextMonthStart,
    );

    const [
      collectionsSummaryPart,
      collectionCasesPart,
      collectionFollowUpsPart,
      activeStudentsPart,
      studentStatusCountsPart,
      pendingPreRegistrationsPart,
      preRegistrationStatusCountsPart,
      recentPreRegistrationsPart,
      bankSlipsAttentionPart,
      bankSlipAttentionItemsPart,
      activeBusAggregatePart,
      activeAssignmentsByBusPart,
      activeBusesPart,
      pendingCardsPart,
      pendingCardItemsPart,
      documentSnapshotPart,
      studentsByInstitutionPart,
      preRegistrationsByMonthPart,
      invoiceStatusSummaryPart,
      paidThisMonthSummaryPart,
      bankSlipErrorsPart,
      overdueFollowUpsPart,
    ] = await Promise.all([
      this.readDashboardPart(
        () => this.collections.getSummary(collectionFilters, currentUser),
        this.emptyCollectionSummary(),
      ),
      this.readDashboardPart(
        () =>
          this.collections.listCases(
            {
              ...collectionFilters,
              page: 1,
              limit: 20,
            } as ListCollectionCasesDto,
            { page: 1, limit: 20 },
            currentUser,
          ),
        this.emptyCollectionCases(),
      ),
      this.readDashboardPart(
        () =>
          this.collections.listFollowUps(
            {
              ...collectionFilters,
              followUpFrom: this.toDateOnly(today),
              followUpTo: this.toDateOnly(today),
            },
            currentUser,
          ),
        this.emptyCollectionFollowUps(),
      ),
      this.readDashboardPart(
        () => this.prisma.student.count({ where: studentWhere }),
        0,
      ),
      this.readDashboardPart(
        () =>
          this.prisma.student.groupBy({
            by: ["status"],
            where: this.studentWhere(enrollmentWhere, false),
            _count: { _all: true },
          }),
        [],
      ),
      this.readDashboardPart(
        () =>
          this.prisma.publicPreRegistration.count({
            where: {
              ...preRegistrationWhere,
              status: PreRegistrationStatus.PENDING,
            },
          }),
        0,
      ),
      this.readDashboardPart(
        () =>
          this.prisma.publicPreRegistration.groupBy({
            by: ["status"],
            where: preRegistrationWhere,
            _count: { _all: true },
          }),
        [],
      ),
      this.readDashboardPart(
        () =>
          this.prisma.publicPreRegistration.findMany({
            where: {
              ...preRegistrationWhere,
              status: PreRegistrationStatus.PENDING,
            },
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
        [],
      ),
      this.readDashboardPart(
        () =>
          this.prisma.bankSlip.count({
            where: {
              status: { in: [...BANK_SLIP_ATTENTION_STATUSES] },
              invoice: { enrollment: invoiceEnrollmentWhere },
            },
          }),
        0,
      ),
      this.readDashboardPart(
        () =>
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
        [],
      ),
      this.readDashboardPart(
        () =>
          this.prisma.bus.aggregate({
            where: { status: RecordStatus.ACTIVE },
            _count: { _all: true },
            _sum: { capacity: true },
          }),
        { _count: { _all: 0 }, _sum: { capacity: null } },
      ),
      this.readDashboardPart(
        () =>
          this.prisma.busAssignment.groupBy({
            by: ["busId"],
            where: {
              status: "ACTIVE",
              enrollment: invoiceEnrollmentWhere,
            },
            _count: { _all: true },
          }),
        [],
      ),
      this.readDashboardPart(
        () =>
          this.prisma.bus.findMany({
            where: { status: RecordStatus.ACTIVE },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            select: { id: true, name: true, capacity: true },
          }),
        [],
      ),
      this.readDashboardPart(
        () =>
          this.prisma.enrollment.count({
            where: this.pendingCardEnrollmentWhere(enrollmentWhere),
          }),
        0,
      ),
      this.readDashboardPart(
        () =>
          this.prisma.enrollment.findMany({
            where: this.pendingCardEnrollmentWhere(enrollmentWhere),
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 5,
            select: {
              id: true,
              createdAt: true,
              student: {
                select: { id: true, person: { select: { fullName: true } } },
              },
              institution: { select: { name: true } },
              academicYear: { select: { year: true } },
            },
          }),
        [],
      ),
      this.readDashboardPart(
        () => this.documentSnapshot(studentWhere),
        { missingCount: 0, items: [] },
      ),
      this.readDashboardPart(
        () => this.studentsByInstitution(enrollmentWhere),
        this.emptyChart("studentsByInstitution", "Academicos por instituicao"),
      ),
      this.readDashboardPart(
        () => this.preRegistrationsByMonth(preRegistrationWhere),
        {
          key: "preRegistrationsByMonth",
          title: "Pre-cadastros por mes",
          description: "Entrada mensal de pre-cadastros",
          type: "line" as const,
          data: [],
        },
      ),
      this.readDashboardPart(
        () =>
          this.prisma.invoice.groupBy({
            by: ["status"],
            where: { enrollment: invoiceEnrollmentWhere },
            _count: { _all: true },
            _sum: { amountCents: true },
          }),
        [],
      ),
      this.readDashboardPart(
        () =>
          this.prisma.bankSlip.aggregate({
            where: paidThisMonthWhere,
            _count: { _all: true },
            _sum: { paidAmountCents: true },
          }),
        { _count: { _all: 0 }, _sum: { paidAmountCents: null } },
      ),
      this.readDashboardPart(
        () =>
          this.prisma.bankSlip.count({
            where: {
              status: { in: [...BANK_SLIP_ERROR_STATUSES] },
              invoice: { enrollment: invoiceEnrollmentWhere },
            },
          }),
        0,
      ),
      this.readDashboardPart(
        () =>
          this.collections.listFollowUps(
            {
              ...collectionFilters,
              followUpTo: this.toDateOnly(
                new Date(today.getTime() - 24 * 60 * 60 * 1000),
              ),
            },
            currentUser,
          ),
        this.emptyCollectionFollowUps(),
      ),
    ]);
    const collectionsSummary = collectionsSummaryPart.data;
    const collectionCases = collectionCasesPart.data;
    const collectionFollowUps = collectionFollowUpsPart.data;
    const activeStudents = activeStudentsPart.data;
    const studentStatusCounts = studentStatusCountsPart.data;
    const pendingPreRegistrations = pendingPreRegistrationsPart.data;
    const preRegistrationStatusCounts = preRegistrationStatusCountsPart.data;
    const recentPreRegistrations = recentPreRegistrationsPart.data;
    const bankSlipsAttention = bankSlipsAttentionPart.data;
    const bankSlipAttentionItems = bankSlipAttentionItemsPart.data;
    const activeBusAggregate = activeBusAggregatePart.data;
    const activeAssignmentsByBus = activeAssignmentsByBusPart.data;
    const activeBuses = activeBusesPart.data;
    const pendingCards = pendingCardsPart.data;
    const pendingCardItems = pendingCardItemsPart.data;
    const documentSnapshot = documentSnapshotPart.data;
    const studentsByInstitution = studentsByInstitutionPart.data;
    const preRegistrationsByMonth = preRegistrationsByMonthPart.data;
    const invoiceStatusSummary = invoiceStatusSummaryPart.data;
    const paidThisMonthSummary = paidThisMonthSummaryPart.data;
    const bankSlipErrors = bankSlipErrorsPart.data;
    const overdueFollowUps = overdueFollowUpsPart.data;

    const busCapacity = activeBusAggregate._sum.capacity ?? 0;
    const occupiedSeats = activeAssignmentsByBus.reduce(
      (total, item) => total + item._count._all,
      0,
    );
    const availableSeats = Math.max(busCapacity - occupiedSeats, 0);
    const busAttention = this.busAttentionItems(activeBuses, activeAssignmentsByBus);
    const fullBusCount = busAttention.filter((item) => item.status === "FULL").length;
    const suspendedStudents = this.statusCount(
      studentStatusCounts,
      StudentStatus.SUSPENDED,
    );
    const terminatedStudents = this.statusCount(
      studentStatusCounts,
      StudentStatus.TERMINATED,
    );
    const invoiceAmountByStatus = this.invoiceAmountByStatus(invoiceStatusSummary);
    const openInvoiceCount = this.invoiceCountByStatus(
      invoiceStatusSummary,
      InvoiceStatus.OPEN,
    );
    const openAmountCents = invoiceAmountByStatus.get(InvoiceStatus.OPEN) ?? 0;
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
      href({ area: "students", studentStatus: "active" }),
    );
    const documentsAttentionOperationalMetric = {
      ...documentsAttentionMetric,
      label: "Documentacao pendente",
    };
    const suspendedStudentsMetric = this.metric(
      "suspendedStudents",
      "Suspensos",
      suspendedStudents,
      this.formatInteger(suspendedStudents),
      "Academicos com matricula no escopo filtrado",
      suspendedStudents > 0 ? "warning" : "success",
      href({ area: "students", studentStatus: "suspended" }),
    );
    const terminatedStudentsMetric = this.metric(
      "terminatedStudents",
      "Desligados",
      terminatedStudents,
      this.formatInteger(terminatedStudents),
      "Academicos encerrados no escopo filtrado",
      terminatedStudents > 0 ? "neutral" : "success",
      href({ area: "students", studentStatus: "terminated" }),
    );
    const openAmountMetric = this.metric(
      "openAmount",
      "Total em aberto",
      openAmountCents,
      this.formatCents(openAmountCents),
      `${this.formatInteger(openInvoiceCount)} fatura(s) aberta(s)`,
      openAmountCents > 0 ? "warning" : "success",
      href({ area: "finance", financeArea: "invoices", invoiceStatus: "OPEN" }),
    );
    const totalOverdueAmountMetric = {
      ...overdueAmountMetric,
      href: href({
        area: "finance",
        financeArea: "invoices",
        invoiceStatus: "OPEN",
        overdue: "overdue",
      }),
      label: "Total vencido",
    };
    const paidThisMonthInstitutionId =
      query.institutionId ?? (institutionIds?.length === 1 ? institutionIds[0] : undefined);
    const paidThisMonthMetric = this.metric(
      "paidThisMonth",
      `Recebido em ${this.monthName(monthStart)}`,
      paidThisMonthSummary._sum.paidAmountCents ?? 0,
      this.formatCents(paidThisMonthSummary._sum.paidAmountCents ?? 0),
      `${this.formatInteger(paidThisMonthSummary._count._all)} boleto(s) pago(s). Pagamentos confirmados pela data de recebimento`,
      (paidThisMonthSummary._sum.paidAmountCents ?? 0) > 0 ? "success" : "neutral",
      this.dashboardHref(
        {
          area: "finance",
          financeArea: "invoices",
          invoiceStatus: "PAID",
          paidAtFrom: this.toDateOnly(monthStart),
          paidAtTo: this.toDateOnly(new Date(nextMonthStart.getTime() - 86_400_000)),
        },
        undefined,
        paidThisMonthInstitutionId,
      ),
    );
    const bankSlipErrorsMetric = this.metric(
      "bankSlipErrors",
      "Boletos com erro",
      bankSlipErrors,
      this.formatInteger(bankSlipErrors),
      "Falha de emissao, baixa ou status desconhecido",
      bankSlipErrors > 0 ? "danger" : "success",
      href({ area: "finance", financeArea: "invoices" }),
    );
    const pendingCollectionsMetric = this.metric(
      "pendingCollections",
      "Cobrancas pendentes",
      collectionsSummary.invoiceCount,
      this.formatInteger(collectionsSummary.invoiceCount),
      "Faturas vencidas em acompanhamento",
      collectionsSummary.invoiceCount > 0 ? "warning" : "success",
      href({ area: "finance", financeArea: "collections" }),
    );
    const promisesActiveMetric = this.metric(
      "promisesActive",
      "Promessas de pagamento",
      collectionsSummary.promisesActiveCount,
      this.formatInteger(collectionsSummary.promisesActiveCount),
      "Promessas ainda dentro do prazo",
      collectionsSummary.promisesActiveCount > 0 ? "warning" : "success",
      href({
        area: "finance",
        financeArea: "collections",
        collectionOperationalStatus: "PROMISE_ACTIVE",
      }),
    );
    const promisesBrokenMetric = this.metric(
      "promisesBroken",
      "Promessas vencidas",
      collectionsSummary.promisesBrokenCount,
      this.formatInteger(collectionsSummary.promisesBrokenCount),
      "Promessas que exigem retomada",
      collectionsSummary.promisesBrokenCount > 0 ? "danger" : "success",
      href({
        area: "finance",
        financeArea: "collections",
        collectionOperationalStatus: "PROMISE_BROKEN",
      }),
    );
    const followUpsTodayMetric = this.metric(
      "followUpsToday",
      "Follow-ups de hoje",
      collectionsSummary.followUpsTodayCount,
      this.formatInteger(collectionsSummary.followUpsTodayCount),
      "Retornos previstos para hoje",
      collectionsSummary.followUpsTodayCount > 0 ? "warning" : "success",
      href({
        area: "finance",
        financeArea: "collections",
        followUpFrom: this.toDateOnly(today),
        followUpTo: this.toDateOnly(today),
      }),
    );
    const overdueFollowUpsMetric = this.metric(
      "overdueFollowUps",
      "Follow-ups atrasados",
      overdueFollowUps.data.length,
      this.formatInteger(overdueFollowUps.data.length),
      "Retornos com data anterior a hoje",
      overdueFollowUps.data.length > 0 ? "danger" : "success",
      href({
        area: "finance",
        financeArea: "collections",
        followUpTo: this.toDateOnly(
          new Date(today.getTime() - 24 * 60 * 60 * 1000),
        ),
      }),
    );
    const activeBusesMetric = this.metric(
      "activeBuses",
      "Onibus ativos",
      activeBusAggregate._count._all,
      this.formatInteger(activeBusAggregate._count._all),
      "Veiculos disponiveis para operacao",
      activeBusAggregate._count._all > 0 ? "success" : "neutral",
      href({ area: "base", baseDomain: "buses" }),
    );
    const availableSeatsMetric = this.metric(
      "availableSeats",
      "Vagas disponiveis",
      availableSeats,
      this.formatInteger(availableSeats),
      `${this.formatInteger(occupiedSeats)}/${this.formatInteger(busCapacity)} vaga(s) ocupada(s)`,
      availableSeats > 0 ? "success" : "danger",
      href({ area: "base", baseDomain: "buses" }),
    );
    const fullBusesMetric = this.metric(
      "fullBuses",
      "Onibus lotados",
      fullBusCount,
      this.formatInteger(fullBusCount),
      "Sem vagas disponiveis",
      fullBusCount > 0 ? "danger" : "success",
      href({ area: "base", baseDomain: "buses" }),
    );
    const academicsParts = [
      activeStudentsPart,
      studentStatusCountsPart,
      pendingPreRegistrationsPart,
      preRegistrationStatusCountsPart,
      recentPreRegistrationsPart,
      pendingCardsPart,
      pendingCardItemsPart,
      documentSnapshotPart,
      studentsByInstitutionPart,
      preRegistrationsByMonthPart,
    ];
    const financeParts = [
      collectionsSummaryPart,
      collectionCasesPart,
      collectionFollowUpsPart,
      bankSlipsAttentionPart,
      bankSlipAttentionItemsPart,
      invoiceStatusSummaryPart,
      paidThisMonthSummaryPart,
      bankSlipErrorsPart,
    ];
    const collectionsParts = [
      collectionsSummaryPart,
      collectionCasesPart,
      collectionFollowUpsPart,
      overdueFollowUpsPart,
    ];
    const transportParts = [
      activeBusAggregatePart,
      activeAssignmentsByBusPart,
      activeBusesPart,
    ];
    const operationalBlocks: DashboardOperationalBlock[] = [
      {
        key: "academics",
        title: "Academico",
        description: "Status dos academicos, pre-cadastros e documentos",
        status: this.blockStatus(academicsParts),
        error: this.blockError(academicsParts),
        metrics: [
          {
            ...activeStudentsMetric,
            href: href({ area: "students", studentStatus: "active" }),
          },
          suspendedStudentsMetric,
          terminatedStudentsMetric,
          {
            ...pendingPreRegistrationsMetric,
            href: href({
              area: "pre-registrations",
              preRegistrationStatus: "PENDING",
            }),
          },
          documentsAttentionOperationalMetric,
        ],
      },
      {
        key: "finance",
        title: "Financeiro",
        description: "Valores e boletos que exigem acompanhamento",
        status: this.blockStatus(financeParts),
        error: this.blockError(financeParts),
        metrics: [
          openAmountMetric,
          totalOverdueAmountMetric,
          paidThisMonthMetric,
          {
            ...overdueInvoicesMetric,
            href: href({
              area: "finance",
              financeArea: "invoices",
              invoiceStatus: "OPEN",
              overdue: "overdue",
            }),
          },
          bankSlipErrorsMetric,
          pendingCollectionsMetric,
        ],
      },
      {
        key: "collections",
        title: "Cobranca",
        description: "Promessas e retornos da rotina diaria",
        status: this.blockStatus(collectionsParts),
        error: this.blockError(collectionsParts),
        metrics: [
          promisesActiveMetric,
          promisesBrokenMetric,
          followUpsTodayMetric,
          overdueFollowUpsMetric,
        ],
      },
      {
        key: "transport",
        title: "Transporte",
        description: "Capacidade dos onibus no ano letivo selecionado",
        status: this.blockStatus(transportParts),
        error: this.blockError(transportParts),
        metrics: [
          activeBusesMetric,
          availableSeatsMetric,
          fullBusesMetric,
        ],
      },
      {
        key: "quickActions",
        title: "Acoes rapidas",
        description: "Entradas diretas para as operacoes mais frequentes",
        status: "loaded",
        metrics: [],
        shortcuts: this.quickShortcuts(href),
      },
    ];

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
      operationalBlocks,
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
      quickShortcuts: this.quickShortcuts(href),
    };
  }

  private dashboardHref(
    params: Record<string, string | undefined>,
    academicYearId?: string,
    institutionId?: string,
  ): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }
    if (academicYearId) {
      search.set("academicYearId", academicYearId);
    }
    if (institutionId) {
      search.set("institutionId", institutionId);
    }
    return `/admin?${search.toString()}`;
  }

  private async readDashboardPart<T>(
    read: () => Promise<T>,
    fallback: T,
  ): Promise<DashboardPart<T>> {
    try {
      return { data: await read(), error: null, ok: true };
    } catch (error) {
      return {
        data: fallback,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar este bloco.",
        ok: false,
      };
    }
  }

  private blockStatus(parts: Array<DashboardPart<unknown>>): "loaded" | "error" {
    return parts.every((part) => part.ok) ? "loaded" : "error";
  }

  private blockError(parts: Array<DashboardPart<unknown>>): string | null {
    const firstError = parts.find((part) => !part.ok)?.error;
    return firstError
      ? `Nao foi possivel carregar este bloco: ${firstError}`
      : null;
  }

  private emptyCollectionSummary() {
    return {
      totalOverdueCents: 0,
      invoiceCount: 0,
      studentCount: 0,
      averageOverdueAmountCents: 0,
      agingBuckets: {
        DAYS_1_30: 0,
        DAYS_31_60: 0,
        DAYS_61_90: 0,
        DAYS_90_PLUS: 0,
      },
      promisesActiveCount: 0,
      promisesBrokenCount: 0,
      followUpsTodayCount: 0,
      partialPaymentReviewCount: 0,
    };
  }

  private emptyCollectionCases() {
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }

  private emptyCollectionFollowUps() {
    return { data: [] };
  }

  private emptyChart(key: string, title: string): DashboardChart {
    return {
      key,
      title,
      description: "Dados indisponiveis no momento",
      type: "bar",
      data: [],
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
    const institutionFilter = scopedInstitutionFilter(
      currentUser,
      query.institutionId,
    );
    if (!institutionFilter) {
      return undefined;
    }
    if (typeof institutionFilter === "string") {
      return [institutionFilter];
    }
    return institutionFilter.in;
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

  private paidThisMonthWhere(
    institutionIds: string[] | undefined,
    monthStart: Date,
    nextMonthStart: Date,
  ): Prisma.BankSlipWhereInput {
    return {
      status: BankSlipStatus.PAID,
      paidAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
      ...(institutionIds
        ? {
            invoice: {
              enrollment: {
                institutionId:
                  institutionIds.length === 1 ? institutionIds[0] : { in: institutionIds },
              },
            },
          }
        : {}),
    };
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
    return buildPendingCardEnrollmentWhere(enrollmentWhere);
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
    href?: string,
  ): DashboardMetric {
    return { key, label, value, formattedValue, context, status, href };
  }

  private listItem(input: DashboardListItem): DashboardListItem {
    return input;
  }

  private quickShortcuts(
    href: (params: Record<string, string | undefined>) => string,
  ): DashboardQuickShortcut[] {
    return [
      {
        key: "students",
        label: "Novo aluno",
        href: href({ area: "students", action: "new" }),
      },
      {
        key: "collections",
        label: "Nova cobranca",
        href: href({ area: "finance", financeArea: "collections" }),
      },
      {
        key: "finance",
        label: "Emitir boletos",
        href: href({ area: "finance" }),
      },
      {
        key: "finance-import",
        label: "Importar retorno",
        href: href({ area: "finance" }),
      },
      {
        key: "buses",
        label: "Cadastrar onibus",
        href: href({ area: "base", baseDomain: "buses" }),
      },
      {
        key: "institutions",
        label: "Cadastrar instituicao",
        href: href({ area: "base", baseDomain: "institutions" }),
      },
      {
        key: "reports",
        label: "Relatorios",
        href: "/admin?area=dashboard",
      },
    ];
  }

  private invoiceAmountByStatus(
    rows: Array<{
      status: InvoiceStatus;
      _sum: { amountCents: number | null };
    }>,
  ) {
    return new Map(
      rows.map((row) => [row.status, row._sum.amountCents ?? 0] as const),
    );
  }

  private invoiceCountByStatus(
    rows: Array<{
      status: InvoiceStatus;
      _count: { _all: number };
    }>,
    status: InvoiceStatus,
  ) {
    return rows.find((row) => row.status === status)?._count._all ?? 0;
  }

  private startOfUtcMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private startOfNextUtcMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
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

  private monthName(date: Date) {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      timeZone: "UTC",
    }).format(date);
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
