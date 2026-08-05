"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileBarChart2,
  FileSpreadsheet,
  Filter,
  Loader2,
  Printer,
  Search,
} from "lucide-react";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type BaseRecord,
  type BusRecord,
  type CollectionOperationalStatus,
  type InvoiceStatus,
  type ListResponse,
  type StudentCardStatus,
  type StudentDocumentType,
  type StudentStatus,
} from "../../lib/api";
import { adminTheme, cx } from "./admin-theme";
import {
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
} from "./components/admin-ui";
import {
  downloadReportPdf,
  downloadReportXlsx,
  printReport,
  type GeneratedReport,
  type ReportColumn,
  type ReportRow,
} from "./reports/report-export";

type ReportCategory =
  | "Acadêmicos"
  | "Transporte"
  | "Financeiro"
  | "Carteirinhas"
  | "Rematrículas";

type ReportFilterKey =
  | "academicYearId"
  | "busId"
  | "city"
  | "course"
  | "cpf"
  | "dateFrom"
  | "dateTo"
  | "institutionId"
  | "search"
  | "status";

type ReportFilters = Record<ReportFilterKey, string>;
type ReportFunctionalStatus =
  | "CONFIÁVEL"
  | "PRECISA DE ENDPOINT/FILTRO"
  | "SEM DEFINIÇÃO FUNCIONAL"
  | "DUPLICADO";

type ReportDefinition = {
  category: ReportCategory;
  description: string;
  disabledReason?: string;
  filterKeys: ReportFilterKey[];
  id: string;
  status: ReportFunctionalStatus;
  title: string;
  build: (context: ReportBuildContext) => Promise<GeneratedReport>;
};

type ReportBuildContext = {
  buses: BusRecord[];
  filters: ReportFilters;
  institutions: BaseRecord[];
  user: ApiUser;
  years: AcademicYear[];
};

const EMPTY_FILTERS: ReportFilters = {
  academicYearId: "",
  busId: "",
  city: "",
  course: "",
  cpf: "",
  dateFrom: "",
  dateTo: "",
  institutionId: "",
  search: "",
  status: "",
};

const STUDENT_COLUMNS: ReportColumn[] = [
  { key: "student", label: "Acadêmico" },
  { key: "cpf", label: "CPF" },
  { key: "status", label: "Status" },
  { key: "institution", label: "Instituição" },
  { key: "course", label: "Curso" },
  { key: "academicYear", label: "Ano letivo", type: "number" },
  { key: "joinedAt", label: "Entrada", type: "date" },
];

const INVOICE_COLUMNS: ReportColumn[] = [
  { key: "student", label: "Acadêmico" },
  { key: "cpf", label: "CPF" },
  { key: "status", label: "Status" },
  { key: "dueDate", label: "Vencimento", type: "date" },
  { key: "amountCents", label: "Valor", type: "currency" },
  { key: "paidAt", label: "Pagamento", type: "date" },
  { key: "institution", label: "Instituição" },
  { key: "bankSlip", label: "Boleto" },
];

const CARD_COLUMNS: ReportColumn[] = [
  { key: "student", label: "Acadêmico" },
  { key: "cpf", label: "CPF" },
  { key: "cardNumber", label: "Carteirinha" },
  { key: "status", label: "Status" },
  { key: "validity", label: "Validade" },
  { key: "issuedAt", label: "Emissão", type: "date" },
  { key: "institution", label: "Instituição" },
  { key: "academicYear", label: "Ano letivo", type: "number" },
];

const DOCUMENT_TYPE_LABELS: Record<StudentDocumentType, string> = {
  CPF: "CPF",
  RG: "RG",
  PHOTO: "Foto",
  PROOF_OF_ADDRESS: "Comprovante de endereço",
  PROOF_OF_ENROLLMENT: "Comprovante de matrícula",
};

const REPORT_CATEGORIES: ReportCategory[] = [
  "Acadêmicos",
  "Transporte",
  "Financeiro",
  "Carteirinhas",
  "Rematrículas",
];

const REPORTS: ReportDefinition[] = [
  studentReport("students-active", "Acadêmicos ativos", "Acadêmicos", "Lista de acadêmicos ativos por período, instituição e busca.", "active"),
  studentReport("students-suspended", "Acadêmicos suspensos", "Acadêmicos", "Acadêmicos suspensos preservando filtros homologados.", "suspended"),
  studentReport("students-terminated", "Acadêmicos desligados", "Acadêmicos", "Acadêmicos desligados por instituição, curso e ano letivo.", "terminated"),
  studentReport("students-by-institution", "Acadêmicos por instituição", "Acadêmicos", "Distribuição operacional de acadêmicos por unidade.", "active"),
  studentReport("students-by-course", "Acadêmicos por curso", "Acadêmicos", "Relação de acadêmicos agrupável por curso.", "active", ["academicYearId", "institutionId", "course", "search"]),
  studentReport("students-by-year", "Acadêmicos por ano letivo", "Acadêmicos", "Acadêmicos filtrados por período letivo.", "active"),
  busAssignmentsReport("students-by-bus", "Acadêmicos por ônibus", "Acadêmicos", "Acadêmicos vinculados ao ônibus selecionado ou a todos os ônibus."),
  documentationReport("students-without-documents", "Acadêmicos sem documentação", "Acadêmicos", "Acadêmicos ativos sem documentos esperados ativos.", "none"),
  documentationReport("students-documents-pending", "Acadêmicos com documentação pendente", "Acadêmicos", "Acadêmicos ativos com parte da documentação esperada ausente.", "partial"),
  busesReport("buses", "Ônibus cadastrados", "Transporte", "Cadastro operacional de ônibus."),
  busesReport("bus-occupancy", "Ocupação dos ônibus", "Transporte", "Ocupação atual e vagas por ônibus."),
  busesReport("available-seats", "Vagas disponíveis", "Transporte", "Ônibus ativos com vagas disponíveis conforme ocupação oficial.", "available"),
  busesReport("full-buses", "Ônibus lotados", "Transporte", "Ônibus com ocupação maior ou igual à capacidade oficial.", "full"),
  invoiceReport("open-invoices", "Faturas abertas", "Financeiro", "Faturas abertas conforme filtros financeiros atuais.", "OPEN"),
  invoiceReport("overdue-invoices", "Faturas vencidas", "Financeiro", "Faturas abertas e vencidas.", "OPEN", "overdue"),
  invoiceReport("paid-invoices", "Faturas pagas", "Financeiro", "Faturas pagas conforme período informado.", "PAID"),
  invoiceReport("month-payments", "Pagamentos do mês", "Financeiro", "Pagamentos liquidados no mês selecionado.", "PAID", undefined, true),
  invoiceReport("period-payments", "Pagamentos por período", "Financeiro", "Pagamentos liquidados entre data inicial e final.", "PAID", undefined, false),
  invoiceReport("defaulters", "Inadimplentes", "Financeiro", "Acadêmicos com faturas vencidas.", "OPEN", "overdue"),
  collectionReport("pending-collections", "Cobranças pendentes", "Financeiro", "Casos de cobrança em aberto.", {}),
  collectionReport("active-payment-promises", "Promessas ativas", "Financeiro", "Promessas de pagamento ativas conforme status oficial da cobrança.", { operationalStatus: "PROMISE_ACTIVE" }),
  collectionReport("broken-payment-promises", "Promessas vencidas/quebradas", "Financeiro", "Promessas vencidas ou quebradas conforme status oficial da cobrança.", { operationalStatus: "PROMISE_BROKEN" }),
  followUpReport("follow-ups", "Follow-ups", "Financeiro", "Follow-ups de cobrança programados."),
  cardReport("issued-cards", "Emitidas", "Carteirinhas", "Carteirinhas emitidas e ativas.", "ACTIVE"),
  pendingCardsReport("pending-cards", "Pendentes", "Carteirinhas", "Matrículas ativas de acadêmicos ativos sem carteirinha ativa."),
  cardReport("invalid-cards", "Inválidas", "Carteirinhas", "Carteirinhas invalidadas.", "INVALIDATED"),
  cardReport("expired-cards", "Expiradas", "Carteirinhas", "Carteirinhas não utilizáveis.", "ACTIVE", "notUsable"),
  reenrollmentCandidatesReport("reenrollments-pending", "Candidatos à rematrícula", "Rematrículas", "Acadêmicos elegíveis que ainda não possuem matrícula no ano letivo de destino."),
  unavailableReport("reenrollments-completed", "Concluídas", "Rematrículas", "Depende de campanha ou status oficial para distinguir rematrícula concluída de matrícula inicial.", "SEM DEFINIÇÃO FUNCIONAL"),
  unavailableReport("reenrollments-not-started", "Não iniciadas", "Rematrículas", "Depende de campanha de rematrícula e público-alvo persistido.", "SEM DEFINIÇÃO FUNCIONAL"),
];

export function ReportsPanel({ user }: { user: ApiUser }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>("Acadêmicos");
  const [selectedReportId, setSelectedReportId] = useState(REPORTS[0]!.id);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "green" | "orange" | "red"; text: string } | null>(null);

  useEffect(() => {
    let active = true;

    setOptionsLoading(true);
    setOptionsError("");
    Promise.all([
      api.listAcademicYears({ status: "all" }),
      api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
      api.listBuses({ status: "all", limit: 100, sort: "name" }),
    ])
      .then(([yearsResponse, institutionsResponse, busesResponse]) => {
        if (!active) {
          return;
        }
        setYears(yearsResponse.data);
        setInstitutions(institutionsResponse.data);
        setBuses(busesResponse.data);
      })
      .catch((caught) => {
        if (active) {
          setOptionsError(caught instanceof Error ? caught.message : "Não foi possível carregar filtros.");
        }
      })
      .finally(() => {
        if (active) {
          setOptionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleReports = useMemo(
    () => REPORTS.filter((report) => report.category === selectedCategory),
    [selectedCategory],
  );
  const selectedReport =
    REPORTS.find((report) => report.id === selectedReportId) ?? visibleReports[0] ?? REPORTS[0]!;

  function setFilter(key: ReportFilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function changeCategory(category: ReportCategory) {
    const firstReport = REPORTS.find((report) => report.category === category) ?? REPORTS[0]!;
    setSelectedCategory(category);
    setSelectedReportId(firstReport.id);
    setGeneratedReport(null);
    setFeedback(null);
  }

  async function handleGenerate() {
    if (!isReportAvailable(selectedReport)) {
      setGeneratedReport(null);
      setFeedback({
        tone: "orange",
        text: selectedReport.disabledReason ?? "Relatório disponível em uma próxima etapa.",
      });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const report = await selectedReport.build({
        buses,
        filters,
        institutions,
        user,
        years,
      });
      setGeneratedReport(report);
      setFeedback({
        tone: report.rows.length ? "green" : "orange",
        text: report.rows.length
          ? `Relatório gerado com ${report.rows.length} registro(s).`
          : "Relatório gerado sem registros para os filtros aplicados.",
      });
    } catch (caught) {
      setGeneratedReport(null);
      setFeedback({
        tone: "red",
        text: caught instanceof Error ? caught.message : "Não foi possível gerar o relatório.",
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedFilterLabels = selectedReport.filterKeys
    .map((key) => filterLabel(key))
    .join(", ");

  return (
    <section className={adminTheme.page}>
      <AdminModuleHeader
        actions={
          <button
            className={adminTheme.primaryButton}
            disabled={loading || !isReportAvailable(selectedReport)}
            onClick={() => void handleGenerate()}
            type="button"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart2 className="h-4 w-4" />}
            Gerar relatório
          </button>
        }
        description="Gere relatórios operacionais com filtros e permissões já homologados, sem carregar grandes volumes automaticamente."
        eyebrow="Central operacional"
        icon={FileBarChart2}
        title="Relatórios"
      />

      {optionsError ? <AdminFeedback tone="red">{optionsError}</AdminFeedback> : null}
      {feedback ? <AdminFeedback tone={feedback.tone}>{feedback.text}</AdminFeedback> : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
          <AdminSectionHeader
            description="Categorias da Central"
            title="Relatórios"
          />
          <div className="grid gap-2 p-3">
            {REPORT_CATEGORIES.map((category) => (
              <button
                aria-current={selectedCategory === category ? "page" : undefined}
                className={cx(
                  "rounded-xl border px-3 py-3 text-left text-sm transition focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15",
                  selectedCategory === category
                    ? "border-[#0F2E2E] bg-[#0F2E2E] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#8DB7AD] hover:bg-[#F2F8F6]",
                )}
                key={category}
                onClick={() => changeCategory(category)}
                type="button"
              >
                <span className="block font-semibold">{category}</span>
                <span className={cx("mt-1 block text-xs", selectedCategory === category ? "text-slate-300" : "text-slate-500")}>
                  {REPORTS.filter((report) => report.category === category).length} modelos
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 gap-4">
          <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
            <AdminSectionHeader
              description="Escolha um relatório para habilitar os filtros aplicáveis."
              title={selectedCategory}
            />
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleReports.map((report) => (
                <button
                  className={cx(
                    adminTheme.cardHover,
                    "min-w-0 rounded-xl border p-4 text-left focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15",
                    selectedReport.id === report.id
                      ? "border-[#0F2E2E] bg-[#F2F8F6]"
                      : "border-slate-200 bg-white",
                  )}
                  key={report.id}
                  onClick={() => {
                    setSelectedReportId(report.id);
                    setGeneratedReport(null);
                    setFeedback(null);
                  }}
                  type="button"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-slate-950">
                    {report.title}
                    <AdminStatusBadge tone={isReportAvailable(report) ? "green" : "orange"}>
                      {isReportAvailable(report) ? "V1" : "Próxima etapa"}
                    </AdminStatusBadge>
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-slate-600">{report.description}</span>
                  {!isReportAvailable(report) ? (
                    <span className="mt-3 block text-xs font-medium text-amber-700">
                      {report.disabledReason}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
            <AdminSectionHeader
              action={<AdminStatusBadge tone="blue">{selectedFilterLabels || "Sem filtros"}</AdminStatusBadge>}
              description="Os filtros são repassados às listagens existentes. O relatório só consulta dados ao gerar."
              title="Filtros"
            />
              <ReportFiltersForm
                buses={buses}
                disabled={loading || optionsLoading || !isReportAvailable(selectedReport)}
              filters={filters}
              institutions={institutions}
              keys={selectedReport.filterKeys}
              onChange={setFilter}
              onClear={() => {
                setFilters(EMPTY_FILTERS);
                setGeneratedReport(null);
                setFeedback(null);
              }}
              onSubmit={() => void handleGenerate()}
              years={years}
            />
          </section>

          <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
            <AdminSectionHeader
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    className={adminTheme.secondaryButton}
                    disabled={!generatedReport || !isReportAvailable(selectedReport)}
                    onClick={() => generatedReport ? downloadReportPdf(generatedReport, user) : undefined}
                    type="button"
                  >
                    <Download className="h-4 w-4" />
                    Gerar PDF
                  </button>
                  <button
                    className={adminTheme.secondaryButton}
                    disabled={!generatedReport || !isReportAvailable(selectedReport)}
                    onClick={() => generatedReport ? downloadReportXlsx(generatedReport, user) : undefined}
                    type="button"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar Excel
                  </button>
                  <button
                    className={adminTheme.secondaryButton}
                    disabled={!generatedReport || !isReportAvailable(selectedReport)}
                    onClick={() => generatedReport ? printReport(generatedReport, user) : undefined}
                    type="button"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </button>
                </div>
              }
              description="Pré-visualização dos primeiros registros gerados."
              title="Pré-visualização"
            />

            {loading ? (
              <div className="p-4">
                <AdminEmptyState loading title="Gerando relatório..." />
              </div>
            ) : generatedReport ? (
              <ReportPreview report={generatedReport} />
            ) : (
              <div className="p-4">
                {isReportAvailable(selectedReport) ? (
                  <AdminEmptyState
                    description="Selecione um modelo, ajuste os filtros e clique em gerar para visualizar, exportar ou imprimir."
                    title="Nenhum relatório gerado"
                  />
                ) : (
                  <AdminEmptyState
                    description={selectedReport.disabledReason ?? "Este relatório aguarda regra funcional oficial para liberar geração e exportação."}
                    title="Disponível em uma próxima etapa"
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function ReportFiltersForm({
  buses,
  disabled,
  filters,
  institutions,
  keys,
  onChange,
  onClear,
  onSubmit,
  years,
}: {
  buses: BusRecord[];
  disabled: boolean;
  filters: ReportFilters;
  institutions: BaseRecord[];
  keys: ReportFilterKey[];
  onChange: (key: ReportFilterKey, value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  years: AcademicYear[];
}) {
  const hasKey = (key: ReportFilterKey) => keys.includes(key);

  return (
    <form
      className="grid min-w-0 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {hasKey("academicYearId") ? (
        <ReportSelect
          disabled={disabled}
          label="Ano letivo"
          onChange={(value) => onChange("academicYearId", value)}
          options={years.map((year) => ({ label: `${year.year}${year.isCurrent ? " · atual" : ""}`, value: year.id }))}
          value={filters.academicYearId}
        />
      ) : null}
      {hasKey("institutionId") ? (
        <ReportSelect
          disabled={disabled}
          label="Instituição"
          onChange={(value) => onChange("institutionId", value)}
          options={institutions.map((institution) => ({ label: institution.name, value: institution.id }))}
          value={filters.institutionId}
        />
      ) : null}
      {hasKey("busId") ? (
        <ReportSelect
          disabled={disabled}
          label="Ônibus"
          onChange={(value) => onChange("busId", value)}
          options={buses.map((bus) => ({ label: `${bus.name} · ${bus.capacity} vagas`, value: bus.id }))}
          value={filters.busId}
        />
      ) : null}
      {hasKey("status") ? (
        <ReportSelect
          disabled={disabled}
          label="Status"
          onChange={(value) => onChange("status", value)}
          options={[
            { label: "Todos", value: "all" },
            { label: "Ativo/Aberta", value: "ACTIVE" },
            { label: "Suspenso/Paga", value: "PAID" },
            { label: "Desligado/Cancelada", value: "CANCELLED" },
          ]}
          value={filters.status}
        />
      ) : null}
      {hasKey("dateFrom") ? (
        <ReportInput
          disabled={disabled}
          label="Data inicial"
          onChange={(value) => onChange("dateFrom", value)}
          type="date"
          value={filters.dateFrom}
        />
      ) : null}
      {hasKey("dateTo") ? (
        <ReportInput
          disabled={disabled}
          label="Data final"
          onChange={(value) => onChange("dateTo", value)}
          type="date"
          value={filters.dateTo}
        />
      ) : null}
      {hasKey("course") ? (
        <ReportInput
          disabled={disabled}
          label="Curso"
          onChange={(value) => onChange("course", value)}
          placeholder="Ex.: Ensino Fundamental"
          value={filters.course}
        />
      ) : null}
      {hasKey("city") ? (
        <ReportInput
          disabled={disabled}
          label="Cidade"
          onChange={(value) => onChange("city", value)}
          placeholder="Cidade"
          value={filters.city}
        />
      ) : null}
      {hasKey("cpf") ? (
        <ReportInput
          disabled={disabled}
          label="CPF"
          onChange={(value) => onChange("cpf", value)}
          placeholder="CPF"
          value={filters.cpf}
        />
      ) : null}
      {hasKey("search") ? (
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700 md:col-span-2">
          Pesquisa textual
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className={cx(adminTheme.control, "w-full pl-9")}
              disabled={disabled}
              onChange={(event) => onChange("search", event.target.value)}
              placeholder="Nome, CPF ou termo do relatório"
              type="search"
              value={filters.search}
            />
          </span>
        </label>
      ) : null}
      <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-4 sm:flex-row">
        <button className={adminTheme.primaryButton} disabled={disabled} type="submit">
          <Filter className="h-4 w-4" />
          Gerar relatório
        </button>
        <button className={adminTheme.secondaryButton} disabled={disabled} onClick={onClear} type="button">
          Limpar filtros
        </button>
      </div>
    </form>
  );
}

function ReportSelect({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
      {label}
      <select
        className={cx(adminTheme.control, "w-full")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReportInput({
  disabled,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
      {label}
      <input
        className={cx(adminTheme.control, "w-full")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function ReportPreview({ report }: { report: GeneratedReport }) {
  const previewRows = report.rows.slice(0, 25);

  return (
    <div className="grid gap-4 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        {report.summary.map((item) => (
          <article
            className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
            key={item.label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-2 break-words text-xl font-semibold leading-6 text-slate-950">
              {item.value}
            </p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {report.filters.length ? report.filters.map((filter) => (
          <AdminStatusBadge key={filter.label} tone="slate">
            {filter.label}: {filter.value}
          </AdminStatusBadge>
        )) : <AdminStatusBadge tone="slate">Sem filtros aplicados</AdminStatusBadge>}
      </div>
      {report.rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-[#0F2E2E] text-white">
              <tr>
                {report.columns.map((column) => (
                  <th className="px-3 py-2 text-left font-semibold" key={column.key}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {previewRows.map((row, index) => (
                <tr key={index}>
                  {report.columns.map((column) => (
                    <td className="max-w-56 px-3 py-2 align-top text-slate-700" key={column.key}>
                      <span className="line-clamp-3 break-words">
                        {formatPreviewCell(row[column.key], column.type)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AdminEmptyState
          description="A exportação continuará disponível com cabeçalho e filtros, mas sem linhas de dados."
          title="Nenhum registro encontrado"
        />
      )}
      {report.rows.length > previewRows.length ? (
        <p className="text-sm text-slate-500">
          Pré-visualização limitada aos primeiros {previewRows.length} registros de {report.rows.length}.
        </p>
      ) : null}
    </div>
  );
}

function studentReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
  status: "active" | "suspended" | "terminated" | "all",
  filterKeys: ReportFilterKey[] = ["academicYearId", "institutionId", "course", "search", "cpf"],
): ReportDefinition {
  return {
    build: async (context) => {
      const students = await fetchAll((page) => api.listStudents({
        academicYearId: context.filters.academicYearId || undefined,
        course: context.filters.course || undefined,
        institutionId: context.filters.institutionId || undefined,
        limit: 100,
        order: "asc",
        page,
        search: context.filters.search || context.filters.cpf || undefined,
        sort: "name",
        status,
      }));
      const rows = students.map(studentRow);
      return makeReport(context, category, title, STUDENT_COLUMNS, rows);
    },
    category,
    description,
    filterKeys,
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function documentationReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
  documentationStatus: "none" | "partial",
): ReportDefinition {
  return {
    build: async (context) => {
      const records = await fetchAll((page) => api.listStudentDocumentationStatus({
        academicYearId: context.filters.academicYearId || undefined,
        documentationStatus,
        institutionId: context.filters.institutionId || undefined,
        limit: 100,
        order: "asc",
        page,
        search: context.filters.search || context.filters.cpf || undefined,
        sort: "name",
      }));
      const rows = records.map((record) => ({
        academicYear: record.academicYear?.year ?? "",
        activeDocumentCount: record.activeDocumentCount,
        cpf: record.cpfMasked,
        documentationStatus: documentationStatusLabel(record.documentationStatus),
        expectedDocumentCount: record.expectedDocumentCount,
        institution: record.institution?.name ?? "",
        missingDocumentCount: record.missingDocumentCount,
        missingTypes: record.missingTypes.map(documentTypeLabel).join(", ") || "-",
        student: record.fullName,
      }));
      return makeReport(context, category, title, [
        { key: "student", label: "Acadêmico" },
        { key: "cpf", label: "CPF" },
        { key: "institution", label: "Instituição" },
        { key: "academicYear", label: "Ano letivo", type: "number" },
        { key: "activeDocumentCount", label: "Documentos enviados", type: "number" },
        { key: "missingDocumentCount", label: "Ausentes", type: "number" },
        { key: "missingTypes", label: "Documentos ausentes" },
        { key: "documentationStatus", label: "Status documental" },
      ], rows);
    },
    category,
    description,
    filterKeys: ["academicYearId", "institutionId", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function unavailableReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
  status: Exclude<ReportFunctionalStatus, "CONFIÁVEL">,
): ReportDefinition {
  return {
    build: async () => {
      throw new Error(description);
    },
    category,
    description,
    disabledReason: description,
    filterKeys: [],
    id,
    status,
    title,
  };
}

function busesReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
  availability?: "available" | "full",
): ReportDefinition {
  return {
    build: async (context) => {
      const buses = await fetchAll((page) => api.listBuses({
        academicYearId: context.filters.academicYearId || undefined,
        availability,
        institutionId: context.filters.institutionId || undefined,
        limit: 100,
        order: "asc",
        page,
        search: context.filters.search || undefined,
        sort: "name",
        status: availability ? "active" : "all",
      }));
      const rows = buses.map((bus) => ({
        availableSeats: bus.availableSeats ?? "",
        bus: bus.name,
        identifier: bus.id,
        capacity: bus.capacity,
        occupiedSeats: bus.occupiedSeats ?? "",
        status: bus.isFull ? "Lotado" : bus.status === "ACTIVE" ? "Com vagas" : "Inativo",
      }));
      return makeReport(context, category, title, [
        { key: "bus", label: "Ônibus" },
        { key: "identifier", label: "Identificação" },
        { key: "capacity", label: "Capacidade", type: "number" },
        { key: "occupiedSeats", label: "Ocupadas", type: "number" },
        { key: "availableSeats", label: "Disponíveis", type: "number" },
        { key: "status", label: "Situação" },
      ], rows);
    },
    category,
    description,
    filterKeys: ["academicYearId", "institutionId", "search"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function busAssignmentsReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
): ReportDefinition {
  return {
    build: async (context) => {
      const buses = context.filters.busId
        ? context.buses.filter((bus) => bus.id === context.filters.busId)
        : [];
      if (!buses.length) {
        throw new Error("Selecione um ônibus para gerar este relatório sem consultas duplicadas.");
      }
      const rows: ReportRow[] = [];
      for (const bus of buses) {
        const assignments = await fetchAll((page) => api.listBusAssignments(bus.id, {
          academicYearId: context.filters.academicYearId || undefined,
          limit: 100,
          page,
          search: context.filters.search || context.filters.cpf || undefined,
          status: "active",
        }));
        rows.push(...assignments.map((assignment) => ({
          academicYear: assignment.enrollment.academicYear.year,
          bus: bus.name,
          course: assignment.enrollment.course,
          cpf: assignment.student.cpfMasked,
          grade: assignment.enrollment.grade,
          institution: assignment.enrollment.institution.name,
          startedAt: assignment.startedAt,
          student: assignment.student.fullName,
        })));
      }
      return makeReport(context, category, title, [
        { key: "bus", label: "Ônibus" },
        { key: "student", label: "Acadêmico" },
        { key: "cpf", label: "CPF" },
        { key: "institution", label: "Instituição" },
        { key: "course", label: "Curso" },
        { key: "grade", label: "Série" },
        { key: "academicYear", label: "Ano letivo", type: "number" },
        { key: "startedAt", label: "Vínculo", type: "date" },
      ], rows);
    },
    category,
    description,
    filterKeys: ["academicYearId", "busId", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function invoiceReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
  status: InvoiceStatus,
  overdue?: "overdue" | "notOverdue",
  currentMonth = false,
): ReportDefinition {
  return {
    build: async (context) => {
      const dateFrom = currentMonth ? firstDayOfMonth() : context.filters.dateFrom;
      const dateTo = currentMonth ? lastDayOfMonth() : context.filters.dateTo;
      const invoices = await fetchAll((page) => api.listInvoices({
        academicYearId: context.filters.academicYearId || undefined,
        dueDateFrom: status === "OPEN" ? context.filters.dateFrom || undefined : undefined,
        dueDateTo: status === "OPEN" ? context.filters.dateTo || undefined : undefined,
        institutionId: context.filters.institutionId || undefined,
        limit: 100,
        order: "asc",
        overdue,
        page,
        paidAtFrom: status === "PAID" ? dateFrom || undefined : undefined,
        paidAtTo: status === "PAID" ? dateTo || undefined : undefined,
        search: context.filters.search || context.filters.cpf || undefined,
        sort: "dueDate",
        status,
      }));
      const rows = invoices.map((invoice) => ({
        amountCents: invoice.amountCents,
        bankSlip: invoice.bankSlipSummary?.status ?? "Sem boleto",
        cpf: invoice.student.person.cpfMasked,
        dueDate: invoice.dueDate,
        institution: invoice.enrollment.institution.name,
        paidAt: invoice.bankSlipSummary?.paidAt ?? "",
        status: invoiceStatusLabel(invoice.status),
        student: invoice.student.person.fullName,
      }));
      return makeReport(context, category, title, INVOICE_COLUMNS, rows, [
        { label: "Valor total", value: formatCurrency(invoices.reduce((sum, invoice) => sum + invoice.amountCents, 0)) },
      ]);
    },
    category,
    description,
    filterKeys: ["academicYearId", "institutionId", "dateFrom", "dateTo", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function collectionReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
  params: { operationalStatus?: CollectionOperationalStatus },
): ReportDefinition {
  return {
    build: async (context) => {
      const cases = await fetchAll((page) => api.listCollectionCases({
        academicYearId: context.filters.academicYearId || undefined,
        dueDateFrom: context.filters.dateFrom || undefined,
        dueDateTo: context.filters.dateTo || undefined,
        institutionId: context.filters.institutionId || undefined,
        limit: 100,
        operationalStatus: params.operationalStatus,
        page,
        search: context.filters.search || context.filters.cpf || undefined,
      }));
      return makeReport(context, category, title, collectionColumns(), cases.map(collectionRow), [
        { label: "Valor em atraso", value: formatCurrency(cases.reduce((sum, item) => sum + item.outstandingAmountCents, 0)) },
      ]);
    },
    category,
    description,
    filterKeys: ["academicYearId", "institutionId", "dateFrom", "dateTo", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function followUpReport(id: string, title: string, category: ReportCategory, description: string): ReportDefinition {
  return {
    build: async (context) => {
      const followUps = await api.listCollectionFollowUps({
        academicYearId: context.filters.academicYearId || undefined,
        followUpFrom: context.filters.dateFrom || undefined,
        followUpTo: context.filters.dateTo || undefined,
        institutionId: context.filters.institutionId || undefined,
        search: context.filters.search || context.filters.cpf || undefined,
      });
      return makeReport(context, category, title, collectionColumns(), followUps.data.map(collectionRow));
    },
    category,
    description,
    filterKeys: ["academicYearId", "institutionId", "dateFrom", "dateTo", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function pendingCardsReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
): ReportDefinition {
  return {
    build: async (context) => {
      const records = await fetchAll((page) => api.listPendingStudentCards({
        academicYearId: context.filters.academicYearId || undefined,
        institutionId: context.filters.institutionId || undefined,
        limit: 100,
        page,
        search: context.filters.search || context.filters.cpf || undefined,
      }));
      const rows = records.map((record) => ({
        academicYear: record.academicYear.year,
        cpf: record.cpfMasked,
        enrollment: record.enrollmentId,
        institution: record.institution.name,
        joinedAt: record.joinedAt,
        photo: record.photoAvailable ? "Disponível" : "Ausente",
        reason: record.blockingReason ?? "-",
        student: record.fullName,
      }));
      return makeReport(context, category, title, [
        { key: "student", label: "Acadêmico" },
        { key: "cpf", label: "CPF" },
        { key: "institution", label: "Instituição" },
        { key: "academicYear", label: "Ano letivo", type: "number" },
        { key: "enrollment", label: "Matrícula" },
        { key: "photo", label: "Foto" },
        { key: "joinedAt", label: "Entrada", type: "date" },
        { key: "reason", label: "Motivo impeditivo" },
      ], rows);
    },
    category,
    description,
    filterKeys: ["academicYearId", "institutionId", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function cardReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
  status: StudentCardStatus,
  validity?: "notUsable",
): ReportDefinition {
  return {
    build: async (context) => {
      const cards = await fetchAll((page) => api.listStudentCards({
        academicYearId: context.filters.academicYearId || undefined,
        limit: 100,
        page,
        search: context.filters.search || context.filters.cpf || undefined,
        status,
        validity,
      }));
      const rows = cards.map((card) => ({
        academicYear: card.academicYear.year,
        cardNumber: card.cardNumber,
        cpf: card.student.person.cpfMasked,
        institution: card.enrollment.institution.name,
        issuedAt: card.issuedAt,
        status: card.status === "ACTIVE" ? "Ativa" : "Invalidada",
        student: card.student.person.fullName,
        validity: card.validity.usable ? "Utilizável" : card.validity.reason ?? "Não utilizável",
      }));
      return makeReport(context, category, title, CARD_COLUMNS, rows);
    },
    category,
    description,
    filterKeys: ["academicYearId", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

function reenrollmentCandidatesReport(
  id: string,
  title: string,
  category: ReportCategory,
  description: string,
): ReportDefinition {
  return {
    build: async (context) => {
      const response = await fetchAllWithMeta((page) => api.listReenrollmentCandidates({
        academicYearId: context.filters.academicYearId || undefined,
        institutionId: context.filters.institutionId || undefined,
        limit: 100,
        order: "asc",
        page,
        search: context.filters.search || context.filters.cpf || undefined,
        sort: "name",
      }));
      const rows = response.rows.map((student) => ({
        academicYear: student.currentEnrollment?.academicYear.year ?? "",
        cpf: student.person.cpfMasked,
        eligibility: "Elegível",
        institution: student.currentEnrollment?.institution.name ?? "",
        reason: "-",
        student: student.person.fullName,
        targetAcademicYear: response.academicYear?.year ?? "",
        transport: "Conforme rematrícula",
      }));
      return makeReport(context, category, title, [
        { key: "student", label: "Acadêmico" },
        { key: "cpf", label: "CPF" },
        { key: "institution", label: "Instituição atual" },
        { key: "academicYear", label: "Ano letivo atual", type: "number" },
        { key: "targetAcademicYear", label: "Ano letivo de destino", type: "number" },
        { key: "eligibility", label: "Elegibilidade" },
        { key: "reason", label: "Motivo de bloqueio" },
        { key: "transport", label: "Transporte" },
      ], rows);
    },
    category,
    description,
    filterKeys: ["academicYearId", "institutionId", "search", "cpf"],
    id,
    status: "CONFIÁVEL",
    title,
  };
}

async function fetchAll<T>(
  loadPage: (page: number) => Promise<ListResponse<T>>,
  maxPages = 10,
) {
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await loadPage(page);
    rows.push(...response.data);
    if (page >= response.pagination.totalPages) {
      break;
    }
  }
  return rows;
}

async function fetchAllWithMeta<T, TExtra extends object>(
  loadPage: (page: number) => Promise<ListResponse<T> & TExtra>,
  maxPages = 10,
) {
  let metadata: TExtra | null = null;
  const rows: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await loadPage(page);
    const { data, pagination, ...rest } = response;
    metadata = rest as TExtra;
    rows.push(...data);
    if (page >= pagination.totalPages) {
      break;
    }
  }
  return { ...(metadata ?? ({} as TExtra)), rows };
}

function makeReport(
  context: ReportBuildContext,
  category: ReportCategory,
  title: string,
  columns: ReportColumn[],
  rows: ReportRow[],
  extraSummary: Array<{ label: string; value: string }> = [],
): GeneratedReport {
  return {
    category,
    columns,
    filters: filterSummary(context),
    generatedAt: new Date().toISOString(),
    rows,
    summary: [
      { label: "Registros", value: String(rows.length) },
      { label: "Categoria", value: category },
      { label: "Fonte", value: "Listagens existentes" },
      ...extraSummary,
    ].slice(0, 4),
    title,
  };
}

function studentRow(student: Awaited<ReturnType<typeof api.listStudents>>["data"][number]): ReportRow {
  return {
    academicYear: student.currentEnrollment?.academicYear.year ?? "",
    course: student.currentEnrollment?.course ?? "",
    cpf: student.person.cpfMasked,
    institution: student.currentEnrollment?.institution.name ?? "",
    joinedAt: student.joinedAt,
    status: studentStatusLabel(student.status),
    student: student.person.fullName,
  };
}

function documentTypeLabel(type: StudentDocumentType) {
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

function documentationStatusLabel(status: "none" | "partial" | "complete") {
  if (status === "none") {
    return "Sem documentação";
  }
  if (status === "partial") {
    return "Documentação pendente";
  }
  return "Documentação completa";
}

function collectionColumns(): ReportColumn[] {
  return [
    { key: "student", label: "Acadêmico" },
    { key: "cpf", label: "CPF" },
    { key: "priority", label: "Prioridade" },
    { key: "status", label: "Status" },
    { key: "dueDate", label: "Vencimento", type: "date" },
    { key: "amountCents", label: "Valor", type: "currency" },
    { key: "nextFollowUpAt", label: "Follow-up", type: "date" },
    { key: "institution", label: "Instituição" },
  ];
}

function collectionRow(item: Awaited<ReturnType<typeof api.listCollectionCases>>["data"][number]): ReportRow {
  return {
    amountCents: item.outstandingAmountCents,
    cpf: item.student.person.cpfMasked,
    dueDate: item.dueDate,
    institution: item.enrollment.institution.name,
    nextFollowUpAt: item.nextFollowUpAt ?? "",
    priority: item.priority,
    status: item.operationalStatus,
    student: item.student.person.fullName,
  };
}

function filterSummary(context: ReportBuildContext) {
  const filters: Array<{ label: string; value: string }> = [];
  const year = context.years.find((item) => item.id === context.filters.academicYearId);
  const institution = context.institutions.find((item) => item.id === context.filters.institutionId);
  const bus = context.buses.find((item) => item.id === context.filters.busId);
  if (year) filters.push({ label: "Ano letivo", value: String(year.year) });
  if (institution) filters.push({ label: "Instituição", value: institution.name });
  if (bus) filters.push({ label: "Ônibus", value: bus.name });
  if (context.filters.dateFrom) filters.push({ label: "Data inicial", value: context.filters.dateFrom });
  if (context.filters.dateTo) filters.push({ label: "Data final", value: context.filters.dateTo });
  if (context.filters.course) filters.push({ label: "Curso", value: context.filters.course });
  if (context.filters.city) filters.push({ label: "Cidade", value: context.filters.city });
  if (context.filters.cpf) filters.push({ label: "CPF", value: context.filters.cpf });
  if (context.filters.search) filters.push({ label: "Pesquisa", value: context.filters.search });
  return filters;
}

function filterLabel(key: ReportFilterKey) {
  const labels: Record<ReportFilterKey, string> = {
    academicYearId: "Ano letivo",
    busId: "Ônibus",
    city: "Cidade",
    course: "Curso",
    cpf: "CPF",
    dateFrom: "Data inicial",
    dateTo: "Data final",
    institutionId: "Instituição",
    search: "Pesquisa",
    status: "Status",
  };
  return labels[key];
}

function isReportAvailable(report: ReportDefinition) {
  return report.status === "CONFIÁVEL";
}

function formatPreviewCell(value: ReportRow[string], type?: ReportColumn["type"]) {
  if (value === null || value === undefined || value === "") return "-";
  if (type === "currency" && typeof value === "number") return formatCurrency(value);
  if (type === "date") return formatDate(String(value));
  return String(value);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

function firstDayOfMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfMonth() {
  const date = new Date();
  return new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0)).toISOString().slice(0, 10);
}

function studentStatusLabel(status: StudentStatus) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "SUSPENDED") return "Suspenso";
  return "Desligado";
}

function invoiceStatusLabel(status: InvoiceStatus) {
  if (status === "OPEN") return "Aberta";
  if (status === "PAID") return "Paga";
  return "Cancelada";
}
