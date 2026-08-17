"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  FileText,
  MinusCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  api,
  type ApiUser,
  type FinancialMonthlyReport,
  type FinancialReportCategory,
  type FinancialReportComparisonMonth,
  type ManualFinancialMovementCategory,
} from "../../../lib/api";
import { mapApiErrorMessage } from "../../../lib/formatters";
import { adminTheme, cx } from "../admin-theme";
import {
  downloadReportPdf,
  type GeneratedReport,
  type FinancialMonthlyPdfCategory,
  type ReportRow,
} from "../reports/report-export";

const categoryLabels: Record<ManualFinancialMovementCategory, string> = {
  SECOND_CARD_COPY: "Segunda via de carteirinha",
  XEROX: "Xerox",
  ADMINISTRATIVE_FEE: "Taxa administrativa",
  EXTRA_CONTRIBUTION: "Contribuição extra",
  DONATION: "Doação",
  FUEL: "Combustível",
  MAINTENANCE: "Manutenção",
  ACCOUNTING: "Contabilidade",
  OFFICE_SUPPLIES: "Material administrativo",
  SERVICES: "Serviços",
  TAXES: "Impostos/taxas",
  PURCHASES: "Compras",
  OTHER: "Outros",
};

const ASSOCIATION_NAME = "ATRETU";
const chartColors = [
  "#1F6F5F",
  "#2563EB",
  "#F59E0B",
  "#7C3AED",
  "#E11D48",
  "#0891B2",
  "#65A30D",
  "#EA580C",
  "#475569",
  "#BE123C",
  "#0D9488",
  "#9333EA",
  "#4D7C0F",
];

export function FinancialReportsPanel({ user }: { user: ApiUser }) {
  const defaultPeriod = useMemo(() => currentSaoPauloMonth(), []);
  const [month, setMonth] = useState(defaultPeriod.month);
  const [year, setYear] = useState(defaultPeriod.year);
  const [report, setReport] = useState<FinancialMonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadReport();
  }, []);

  async function loadReport(nextMonth = month, nextYear = year) {
    setLoading(true);
    setError("");
    setPdfError("");
    try {
      const response = await api.getFinancialMonthlyReport({
        month: nextMonth,
        year: nextYear,
      });
      setReport(response);
      return response;
    } catch (caught) {
      setReport(null);
      const message = caught instanceof Error ? caught.message : "";
      setError(mapApiErrorMessage(message) || "Erro ao carregar relatório financeiro");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReport();
  }

  async function generatePdf() {
    if (loading || pdfLoading) {
      return;
    }
    setPdfLoading(true);
    setPdfError("");
    try {
      const response = await api.getFinancialMonthlyReport({ month, year });
      setReport(response);
      await downloadReportPdf(toGeneratedReport(response), user);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setPdfError(mapApiErrorMessage(message) || "Não foi possível gerar o PDF gerencial.");
    } finally {
      setPdfLoading(false);
    }
  }

  const summary = report?.summary;
  const actionsDisabled = loading || pdfLoading;

  return (
    <section className="grid min-w-0 gap-4">
      <div className={cx(adminTheme.card, "min-w-0 p-5")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#1F6F5F]">
              Regime de caixa
            </p>
            <h2 className={cx(adminTheme.titleText, "mt-1 text-xl")}>
              Relatório financeiro gerencial
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Mensalidades pagas, entradas manuais recebidas e despesas pagas no período.
            </p>
          </div>
          <form
            className="grid min-w-0 gap-2 sm:grid-cols-[120px_120px_auto_auto] sm:items-end"
            onSubmit={submit}
          >
            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Mês
              <select
                className={adminTheme.control}
                onChange={(event) => setMonth(Number(event.target.value))}
                value={month}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {String(value).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
              Ano
              <input
                className={adminTheme.control}
                max={2100}
                min={2020}
                onChange={(event) => setYear(Number(event.target.value))}
                type="number"
                value={year}
              />
            </label>
            <button
              className={cx(adminTheme.secondaryButton, "w-full sm:w-auto")}
              disabled={actionsDisabled}
              type="submit"
            >
              <RefreshCw aria-hidden="true" className={cx("h-4 w-4", loading ? "animate-spin" : undefined)} />
              Atualizar
            </button>
            <button
              className={cx(adminTheme.primaryButton, "w-full sm:w-auto")}
              disabled={actionsDisabled}
              onClick={() => void generatePdf()}
              type="button"
            >
              <FileText aria-hidden="true" className={cx("h-4 w-4", pdfLoading ? "animate-pulse" : undefined)} />
              {pdfLoading ? "Gerando..." : "Gerar relatório"}
            </button>
          </form>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {pdfError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pdfError}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <ReportCard icon={ArrowUpCircle} label="Receita de mensalidades" loading={loading} value={summary?.invoiceRevenueFormatted} />
        <ReportCard icon={ArrowUpCircle} label="Outras entradas" loading={loading} value={summary?.manualIncomeFormatted} />
        <ReportCard icon={TrendingUp} label="Receita total" loading={loading} value={summary?.totalRevenueFormatted} />
        <ReportCard icon={ArrowDownCircle} label="Despesas" loading={loading} value={summary?.expenseFormatted} />
        <ReportCard
          icon={summary?.resultStatus === "NEGATIVE" ? TrendingDown : BarChart3}
          label="Resultado"
          loading={loading}
          tone={summary?.resultStatus === "NEGATIVE" ? "negative" : "positive"}
          value={summary ? `${summary.resultStatus === "NEGATIVE" ? "-" : "+"} ${summary.resultFormatted}` : undefined}
        />
      </div>

      {report ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
          <MonthlyEvolutionChart rows={report.comparison} />
          <div className="grid min-w-0 gap-4">
            <CategoryDonutChart
              empty="Nenhuma despesa paga no período."
              rows={report.expenseCategories}
              title="Despesas por categoria"
            />
            <CategoryDonutChart
              empty="Nenhuma entrada manual recebida no período."
              rows={report.incomeCategories}
              title="Outras entradas"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function toGeneratedReport(report: FinancialMonthlyReport): GeneratedReport {
  return {
    category: "Financeiro",
    columns: [
      { key: "item", label: "Item" },
      { key: "count", label: "Qtd.", type: "number" },
      { key: "revenue", label: "Receita" },
      { key: "expense", label: "Despesa" },
      { key: "result", label: "Resultado" },
      { key: "percentage", label: "%" },
    ],
    financialMonthly: {
      comparison: report.comparison,
      expenseCategories: toPdfCategories(report.expenseCategories),
      incomeCategories: toPdfCategories(report.incomeCategories),
      periodLabel: report.period.label,
      summary: [
        {
          label: "Mensalidades recebidas",
          value: report.summary.invoiceRevenueFormatted,
        },
        {
          label: "Outras entradas",
          value: report.summary.manualIncomeFormatted,
        },
        {
          highlight: true,
          label: "Receita total",
          tone: "positive",
          value: report.summary.totalRevenueFormatted,
        },
        {
          label: "Despesas pagas",
          value: report.summary.expenseFormatted,
        },
        {
          highlight: true,
          label: "Resultado do mês",
          tone: report.summary.resultStatus === "NEGATIVE" ? "negative" : "positive",
          value: `${report.summary.resultStatus === "NEGATIVE" ? "-" : "+"} ${report.summary.resultFormatted}`,
        },
      ],
    },
    filters: [
      { label: "Associação", value: ASSOCIATION_NAME },
      { label: "Período", value: report.period.label },
    ],
    generatedAt: new Date().toISOString(),
    rows: [
      ...summaryRows(report),
      ...comparisonRows(report.comparison),
      ...categoryRows("Despesas por categoria", report.expenseCategories, "expense"),
      ...categoryRows("Entradas por categoria", report.incomeCategories, "revenue"),
    ],
    summary: [
      { label: "Associação", value: ASSOCIATION_NAME },
      { label: "Período", value: report.period.label },
      { label: "Receita total", value: report.summary.totalRevenueFormatted },
      {
        label: "Resultado",
        value: `${report.summary.resultStatus === "NEGATIVE" ? "-" : "+"} ${report.summary.resultFormatted}`,
      },
    ],
    title: "Relatório financeiro gerencial",
  };
}

function summaryRows(report: FinancialMonthlyReport): ReportRow[] {
  return [
    {
      count: "",
      expense: "",
      item: "Mensalidades recebidas",
      percentage: "",
      result: "",
      revenue: report.summary.invoiceRevenueFormatted,
    },
    {
      count: "",
      expense: "",
      item: "Outras entradas",
      percentage: "",
      result: "",
      revenue: report.summary.manualIncomeFormatted,
    },
    {
      count: "",
      expense: "",
      item: "Receita total",
      percentage: "",
      result: "",
      revenue: report.summary.totalRevenueFormatted,
    },
    {
      count: "",
      expense: report.summary.expenseFormatted,
      item: "Despesas pagas",
      percentage: "",
      result: "",
      revenue: "",
    },
    {
      count: "",
      expense: "",
      item: "Resultado",
      percentage: "",
      result: `${report.summary.resultStatus === "NEGATIVE" ? "-" : "+"} ${report.summary.resultFormatted}`,
      revenue: "",
    },
  ];
}

function comparisonRows(rows: FinancialReportComparisonMonth[]): ReportRow[] {
  return rows.map((row) => ({
    count: "",
    expense: row.expenseFormatted,
    item: row.label,
    percentage: "",
    result: `${row.resultStatus === "NEGATIVE" ? "-" : "+"} ${row.resultFormatted}`,
    revenue: row.revenueFormatted,
  }));
}

function categoryRows(
  section: string,
  rows: FinancialReportCategory[],
  target: "expense" | "revenue",
): ReportRow[] {
  if (rows.length === 0) {
    return [
      {
        count: "",
        expense: "",
        item: section,
        percentage: "",
        result: "",
        revenue: "",
      },
    ];
  }
  return rows.map((row) => ({
    count: row.count,
    expense: target === "expense" ? row.totalFormatted : "",
    item: categoryLabels[row.category],
    percentage: `${row.percentage.toFixed(2)}%`,
    result: "",
    revenue: target === "revenue" ? row.totalFormatted : "",
  }));
}

function toPdfCategories(rows: FinancialReportCategory[]): FinancialMonthlyPdfCategory[] {
  return rows.map((row) => ({
    count: row.count,
    label: categoryLabels[row.category],
    percentage: row.percentage,
    totalFormatted: row.totalFormatted,
  }));
}

function ReportCard({
  icon: Icon,
  label,
  loading,
  tone = "neutral",
  value,
}: {
  icon: LucideIcon;
  label: string;
  loading: boolean;
  tone?: "neutral" | "positive" | "negative";
  value?: string;
}) {
  return (
    <article className={cx(adminTheme.card, "min-w-0 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <p className="mt-2 whitespace-nowrap text-xl font-semibold leading-tight text-slate-950 2xl:text-2xl">
            {loading ? "..." : value ?? "R$ 0,00"}
          </p>
        </div>
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-lg border", toneClass(tone))}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

function MonthlyEvolutionChart({ rows }: { rows: FinancialReportComparisonMonth[] }) {
  const hasMovement = rows.some((row) => row.revenueCents !== 0 || row.expenseCents !== 0 || row.resultCents !== 0);
  if (!hasMovement) {
    return (
      <section className={cx(adminTheme.card, "min-w-0 p-5")}>
        <ChartHeader title="Evolução financeira — últimos 12 meses" />
        <EmptyChartState message="Sem movimentação financeira no período." />
      </section>
    );
  }

  const width = 760;
  const height = 320;
  const plot = { bottom: 46, left: 56, right: 28, top: 28 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const maxValue = Math.max(...rows.flatMap((row) => [row.revenueCents, row.expenseCents, row.resultCents]), 1);
  const minValue = Math.min(0, ...rows.map((row) => row.resultCents));
  const range = Math.max(1, maxValue - minValue);
  const baseline = plot.top + (maxValue / range) * plotHeight;
  const groupWidth = plotWidth / rows.length;
  const barWidth = Math.max(4, Math.min(12, groupWidth / 4.5));
  const yFor = (value: number) => plot.top + ((maxValue - value) / range) * plotHeight;
  const gridValues = [maxValue, Math.round((maxValue + minValue) / 2), minValue];

  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")}>
      <ChartHeader title="Evolução financeira — últimos 12 meses" />
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
        <LegendDot color="#1F6F5F" label="Receita" />
        <LegendDot color="#DC2626" label="Despesa" />
        <LegendDot color="#2563EB" label="Resultado positivo" />
        <LegendDot color="#F97316" label="Resultado negativo" />
      </div>
      <div className="mt-3 w-full overflow-hidden">
        <svg aria-label="Gráfico de evolução financeira dos últimos 12 meses" className="block h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
          {gridValues.map((value) => {
            const y = yFor(value);
            return (
              <g key={value}>
                <line stroke="#E2E8F0" strokeWidth="1" x1={plot.left} x2={width - plot.right} y1={y} y2={y} />
                <text fill="#64748B" fontSize="10" textAnchor="end" x={plot.left - 8} y={y + 3}>
                  {formatCompactCurrency(value)}
                </text>
              </g>
            );
          })}
          <line stroke="#94A3B8" strokeWidth="1.2" x1={plot.left} x2={width - plot.right} y1={baseline} y2={baseline} />
          {rows.map((row, index) => {
            const center = plot.left + index * groupWidth + groupWidth / 2;
            const tooltip = `${row.label}\nReceita: ${row.revenueFormatted}\nDespesa: ${row.expenseFormatted}\nResultado: ${formatSignedResult(row)}`;
            const bars = [
              { color: "#1F6F5F", offset: -barWidth * 1.25, value: row.revenueCents },
              { color: "#DC2626", offset: 0, value: row.expenseCents },
              { color: row.resultStatus === "NEGATIVE" ? "#F97316" : "#2563EB", offset: barWidth * 1.25, value: row.resultCents },
            ];
            return (
              <g key={row.month}>
                <title>{tooltip}</title>
                {bars.map((bar) => {
                  const y = yFor(bar.value);
                  const top = Math.min(y, baseline);
                  const height = Math.max(2, Math.abs(baseline - y));
                  return (
                    <rect
                      fill={bar.color}
                      key={`${row.month}-${bar.color}`}
                      rx="2"
                      width={barWidth}
                      x={center + bar.offset - barWidth / 2}
                      y={top}
                      height={height}
                    />
                  );
                })}
                <rect fill="transparent" height={plotHeight} width={groupWidth} x={plot.left + index * groupWidth} y={plot.top}>
                  <title>{tooltip}</title>
                </rect>
                <text fill="#475569" fontSize="10" textAnchor="middle" x={center} y={height - 18}>
                  {row.label.replace(/\s+de\s+/i, "/").replace(/\.$/, "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <ChartMetric label="Maior receita" value={formatCurrency(Math.max(...rows.map((row) => row.revenueCents)))} />
        <ChartMetric label="Maior despesa" value={formatCurrency(Math.max(...rows.map((row) => row.expenseCents)))} />
        <ChartMetric label="Resultado atual" value={formatSignedResult(rows[rows.length - 1]!)} />
      </div>
    </section>
  );
}

function CategoryDonutChart({
  empty,
  rows,
  title,
}: {
  empty: string;
  rows: FinancialReportCategory[];
  title: string;
}) {
  const totalCents = rows.reduce((sum, row) => sum + row.totalCents, 0);
  const hasData = rows.length > 0 && totalCents > 0;
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")}>
      <ChartHeader title={title} />
      {hasData ? (
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[150px_minmax(0,1fr)]">
          <svg aria-label={`Donut de ${title.toLowerCase()}`} className="mx-auto h-[150px] w-[150px]" role="img" viewBox="0 0 120 120">
            <circle cx="60" cy="60" fill="none" r="42" stroke="#E2E8F0" strokeWidth="18" />
            {donutSegments(rows, totalCents).map((segment) => (
              <circle
                cx="60"
                cy="60"
                fill="none"
                key={segment.key}
                r="42"
                stroke={segment.color}
                strokeDasharray={`${segment.length} ${segment.circumference - segment.length}`}
                strokeDashoffset={segment.offset}
                strokeLinecap="butt"
                strokeWidth="18"
                transform="rotate(-90 60 60)"
              >
                <title>{segment.tooltip}</title>
              </circle>
            ))}
            <text fill="#0F172A" fontSize="10" fontWeight="700" textAnchor="middle" x="60" y="57">
              Total
            </text>
            <text fill="#1F6F5F" fontSize="10" fontWeight="700" textAnchor="middle" x="60" y="70">
              {formatCurrency(totalCents)}
            </text>
          </svg>
          <div className="grid min-w-0 gap-2">
            {rows.map((row, index) => (
              <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 text-sm" key={row.category} title={`${categoryLabels[row.category]} - ${row.totalFormatted} - ${row.percentage.toFixed(2)}%`}>
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                  <span className="truncate text-slate-700">{categoryLabels[row.category]}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-950">{row.totalFormatted}</p>
                  <p className="text-xs text-slate-500">{row.percentage.toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyChartState message={empty} />
      )}
    </section>
  );
}

function ChartHeader({ title }: { title: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="mt-4 flex min-h-[132px] items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      <MinusCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ChartMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function donutSegments(rows: FinancialReportCategory[], totalCents: number) {
  const circumference = 2 * Math.PI * 42;
  let offset = 0;
  return rows.map((row, index) => {
    const length = (row.totalCents / totalCents) * circumference;
    const segment = {
      circumference,
      color: chartColors[index % chartColors.length]!,
      key: row.category,
      length,
      offset: -offset,
      tooltip: `${categoryLabels[row.category]}\nValor: ${row.totalFormatted}\nPercentual: ${row.percentage.toFixed(2)}%`,
    };
    offset += length;
    return segment;
  });
}

function currentSaoPauloMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  return {
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    year: Number(parts.find((part) => part.type === "year")?.value ?? "2026"),
  };
}

function toneClass(tone: "neutral" | "positive" | "negative") {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "negative") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function formatCurrency(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueCents / 100);
}

function formatCompactCurrency(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
    currency: "BRL",
  }).format(valueCents / 100);
}

function formatSignedResult(row: FinancialReportComparisonMonth) {
  return `${row.resultStatus === "NEGATIVE" ? "-" : "+"} ${row.resultFormatted}`;
}
