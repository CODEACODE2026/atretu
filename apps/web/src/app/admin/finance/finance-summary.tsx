import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Layers3,
  LineChart,
  PieChart,
  ReceiptText,
  RefreshCw,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { CollectionSummary } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { formatFinanceCurrency, type FinanceSummary } from "./finance-display-utils";

export type FinanceMonthlyOverview = {
  key: string;
  label: string;
  openAmountCents: number;
  overdueAmountCents: number;
  paidAmountCents: number;
};

export type FinanceSituationSlice = {
  amountCents: number;
  color: string;
  count: number;
  key: string;
  label: string;
};

const toneClass = {
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function FinanceSummaryCards({
  collectionError = "",
  collectionLoading = false,
  collectionSummary,
  loading = false,
  monthlyEvolution = [],
  onNavigate,
  onPeriodChange,
  onRefreshOverview,
  overviewLoading = false,
  periodMonth,
  periodYear,
  situationBreakdown = [],
  summary,
}: {
  collectionError?: string;
  collectionLoading?: boolean;
  collectionSummary?: CollectionSummary | null;
  loading?: boolean;
  monthlyEvolution?: FinanceMonthlyOverview[];
  onNavigate?: (area: "invoices" | "collections" | "reports") => void;
  onPeriodChange?: (month: number, year: number) => void;
  onRefreshOverview?: () => void;
  overviewLoading?: boolean;
  periodMonth?: number;
  periodYear?: number;
  situationBreakdown?: FinanceSituationSlice[];
  summary: FinanceSummary;
}) {
  const isFilteredSummary = summary.scope === "filtered";
  const displayValue = (value: string) => (loading ? "..." : value);
  const primaryItems = [
    {
      icon: CircleDollarSign,
      label: "Total em aberto",
      tone: "neutral" as const,
      value: displayValue(formatFinanceCurrency(summary.openAmountCents)),
    },
    {
      icon: AlertTriangle,
      label: "Total vencido",
      tone: summary.overdueAmountCents > 0 ? ("danger" as const) : ("neutral" as const),
      value: displayValue(formatFinanceCurrency(summary.overdueAmountCents)),
    },
    {
      icon: WalletCards,
      label: "Total pago",
      tone: "success" as const,
      value: displayValue(formatFinanceCurrency(summary.paidAmountCents)),
    },
    {
      icon: ReceiptText,
      label: "Total de faturas",
      tone: "neutral" as const,
      value: displayValue(String(summary.totalFilteredInvoiceCount)),
    },
  ];
  const secondaryItems = [
    {
      icon: WalletCards,
      label: "Cancelado/baixado",
      tone: "warning" as const,
      value: displayValue(formatFinanceCurrency(summary.cancelledAmountCents)),
    },
    {
      icon: AlertTriangle,
      label: "Boletos com erro",
      tone: summary.failedBankSlips > 0 ? ("danger" as const) : ("neutral" as const),
      value: displayValue(String(summary.failedBankSlips)),
    },
    {
      icon: ReceiptText,
      label: "Lotes em processamento",
      tone: summary.processingBatches > 0 ? ("warning" as const) : ("neutral" as const),
      value: displayValue(String(summary.processingBatches)),
    },
  ];
  const periodControlsVisible = typeof periodMonth === "number" && typeof periodYear === "number" && onPeriodChange;

  return (
    <section className="grid min-w-0 gap-4" aria-labelledby="finance-summary-title">
      <div className={cx(adminTheme.card, "min-w-0 p-5")}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h2 className={cx(adminTheme.titleText, "text-base")} id="finance-summary-title">
              Resumo financeiro
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {loading
                ? "Atualizando totais operacionais."
                : isFilteredSummary
                ? "Totais agregados pelo backend para as faturas do período e filtros atuais."
                : "Totais das faturas carregadas enquanto o resumo global nao esta disponivel."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {periodControlsVisible ? (
              <>
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Mês
                  <select
                    className={adminTheme.control}
                    disabled={overviewLoading}
                    onChange={(event) => onPeriodChange(Number(event.target.value), periodYear)}
                    value={periodMonth}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>
                        {String(month).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
                  Ano
                  <input
                    className={adminTheme.control}
                    disabled={overviewLoading}
                    max={2100}
                    min={2020}
                    onChange={(event) => onPeriodChange(periodMonth, Number(event.target.value))}
                    type="number"
                    value={periodYear}
                  />
                </label>
              </>
            ) : null}
            {onRefreshOverview ? (
              <button
                className={adminTheme.secondaryButton}
                disabled={overviewLoading}
                onClick={onRefreshOverview}
                type="button"
              >
                <RefreshCw aria-hidden="true" className={cx("h-4 w-4", overviewLoading ? "animate-spin" : undefined)} />
                Atualizar
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                className={cx("rounded-xl border p-4 shadow-sm", toneClass[item.tone])}
                key={item.label}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                </div>
                <p className="mt-3 break-words text-2xl font-bold text-slate-950">{item.value}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                className={cx("rounded-lg border px-3 py-2.5", toneClass[item.tone])}
                key={item.label}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase leading-snug text-slate-500">
                    {item.label}
                  </p>
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                </div>
                <p className="mt-2 break-words text-lg font-bold text-slate-950">{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <FinancialEvolutionChart loading={overviewLoading} rows={monthlyEvolution} />
        <InvoiceSituationDonut loading={overviewLoading} rows={situationBreakdown} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CollectionOverviewCard
          error={collectionError}
          loading={collectionLoading}
          onNavigate={onNavigate}
          summary={collectionSummary}
        />
        <OperationalOverviewCard
          failedBankSlips={summary.failedBankSlips}
          onNavigate={onNavigate}
          processingBatches={summary.processingBatches}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <OverviewAction label="Ver faturas" onClick={() => onNavigate?.("invoices")} />
        {onNavigate ? <OverviewAction label="Ver relatório" onClick={() => onNavigate("reports")} /> : null}
        {collectionSummary ? <OverviewAction label="Ver cobrança" onClick={() => onNavigate?.("collections")} /> : null}
      </div>
    </section>
  );
}

function FinancialEvolutionChart({
  loading,
  rows,
}: {
  loading: boolean;
  rows: FinanceMonthlyOverview[];
}) {
  const hasData = rows.some(
    (row) => row.openAmountCents > 0 || row.overdueAmountCents > 0 || row.paidAmountCents > 0,
  );
  if (loading || !hasData) {
    return (
      <section className={cx(adminTheme.card, "min-w-0 p-5")}>
        <ChartTitle icon={LineChart} title="Evolução financeira — últimos 12 meses" />
        <EmptyChartState message={loading ? "Atualizando evolução financeira." : "Sem faturas no período analisado."} />
      </section>
    );
  }

  const width = 760;
  const height = 320;
  const plot = { bottom: 44, left: 56, right: 24, top: 24 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const maxValue = Math.max(
    ...rows.flatMap((row) => [row.paidAmountCents, row.openAmountCents, row.overdueAmountCents]),
    1,
  );
  const groupWidth = plotWidth / Math.max(rows.length, 1);
  const barWidth = Math.max(5, Math.min(14, groupWidth / 5));
  const yFor = (value: number) => plot.top + ((maxValue - value) / maxValue) * plotHeight;
  const gridValues = [maxValue, Math.round(maxValue / 2), 0];

  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")}>
      <ChartTitle icon={LineChart} title="Evolução financeira — últimos 12 meses" />
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
        <LegendDot color="#1F6F5F" label="Recebido" />
        <LegendDot color="#2563EB" label="Em aberto" />
        <LegendDot color="#DC2626" label="Vencido" />
      </div>
      <div className="mt-3 w-full overflow-hidden">
        <svg aria-label="Evolução financeira dos últimos 12 meses" className="block h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
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
          {rows.map((row, index) => {
            const center = plot.left + index * groupWidth + groupWidth / 2;
            const bars = [
              { color: "#1F6F5F", offset: -barWidth * 1.35, value: row.paidAmountCents },
              { color: "#2563EB", offset: 0, value: row.openAmountCents },
              { color: "#DC2626", offset: barWidth * 1.35, value: row.overdueAmountCents },
            ];
            const tooltip = `${row.label}\nRecebido: ${formatFinanceCurrency(row.paidAmountCents)}\nEm aberto: ${formatFinanceCurrency(row.openAmountCents)}\nVencido: ${formatFinanceCurrency(row.overdueAmountCents)}`;
            return (
              <g key={row.key}>
                <title>{tooltip}</title>
                {bars.map((bar) => {
                  const y = yFor(bar.value);
                  return (
                    <rect
                      fill={bar.color}
                      height={Math.max(2, plot.top + plotHeight - y)}
                      key={`${row.key}-${bar.color}`}
                      rx="2"
                      width={barWidth}
                      x={center + bar.offset - barWidth / 2}
                      y={y}
                    />
                  );
                })}
                <rect fill="transparent" height={plotHeight} width={groupWidth} x={plot.left + index * groupWidth} y={plot.top}>
                  <title>{tooltip}</title>
                </rect>
                <text fill="#475569" fontSize="10" textAnchor="middle" x={center} y={height - 16}>
                  {row.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function InvoiceSituationDonut({
  loading,
  rows,
}: {
  loading: boolean;
  rows: FinanceSituationSlice[];
}) {
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  const hasData = totalCount > 0;
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")}>
      <ChartTitle icon={PieChart} title="Situação das faturas" />
      {loading || !hasData ? (
        <EmptyChartState message={loading ? "Atualizando situação das faturas." : "Nenhuma fatura no período."} />
      ) : (
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[160px_minmax(0,1fr)]">
          <svg aria-label="Donut de situação das faturas" className="mx-auto h-[160px] w-[160px]" role="img" viewBox="0 0 120 120">
            <circle cx="60" cy="60" fill="none" r="42" stroke="#E2E8F0" strokeWidth="18" />
            {donutSegments(rows, totalCount).map((segment) => (
              <circle
                cx="60"
                cy="60"
                fill="none"
                key={segment.key}
                r="42"
                stroke={segment.color}
                strokeDasharray={`${segment.length} ${segment.circumference - segment.length}`}
                strokeDashoffset={segment.offset}
                strokeWidth="18"
                transform="rotate(-90 60 60)"
              >
                <title>{segment.tooltip}</title>
              </circle>
            ))}
            <text fill="#0F172A" fontSize="10" fontWeight="700" textAnchor="middle" x="60" y="57">
              Faturas
            </text>
            <text fill="#1F6F5F" fontSize="13" fontWeight="700" textAnchor="middle" x="60" y="72">
              {totalCount}
            </text>
          </svg>
          <div className="grid min-w-0 gap-2">
            {rows.map((row) => {
              const percentage = totalCount > 0 ? (row.count / totalCount) * 100 : 0;
              return (
                <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 text-sm" key={row.key}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-slate-700">{row.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-950">{row.count} / {percentage.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">{formatFinanceCurrency(row.amountCents)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function CollectionOverviewCard({
  error,
  loading,
  onNavigate,
  summary,
}: {
  error: string;
  loading: boolean;
  onNavigate?: (area: "invoices" | "collections" | "reports") => void;
  summary?: CollectionSummary | null;
}) {
  const values = [
    { icon: UsersRound, label: "Inadimplentes", value: String(summary?.studentCount ?? 0) },
    { icon: CircleDollarSign, label: "Valor vencido", value: formatFinanceCurrency(summary?.totalOverdueCents ?? 0) },
    { icon: CalendarClock, label: "Promessas ativas", value: String(summary?.promisesActiveCount ?? 0) },
    { icon: AlertTriangle, label: "Follow-ups hoje", value: String(summary?.followUpsTodayCount ?? 0) },
  ];
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ChartTitle icon={WalletCards} title="Cobrança" />
        {onNavigate ? <OverviewAction label="Ver cobrança" onClick={() => onNavigate("collections")} /> : null}
      </div>
      {error ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {values.map(({ icon: Icon, label, value }) => (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5" key={label}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
            </div>
            <p className="mt-2 break-words text-lg font-bold text-slate-950">{loading ? "..." : value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OperationalOverviewCard({
  failedBankSlips,
  onNavigate,
  processingBatches,
}: {
  failedBankSlips: number;
  onNavigate?: (area: "invoices" | "collections" | "reports") => void;
  processingBatches: number;
}) {
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ChartTitle icon={Layers3} title="Operacional / boletos" />
        {onNavigate ? <OverviewAction label="Ver faturas" onClick={() => onNavigate("invoices")} /> : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className={cx("rounded-lg border px-3 py-2.5", failedBankSlips > 0 ? toneClass.danger : toneClass.neutral)}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Boletos com erro</p>
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-950">{failedBankSlips}</p>
        </div>
        <div className={cx("rounded-lg border px-3 py-2.5", processingBatches > 0 ? toneClass.warning : toneClass.neutral)}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Lotes em processamento</p>
            <RefreshCw aria-hidden="true" className="h-4 w-4 shrink-0" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-950">{processingBatches}</p>
        </div>
      </div>
    </section>
  );
}

function ChartTitle({ icon: Icon, title }: { icon: typeof LineChart; title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E8F3F0] text-[#1F6F5F]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <h3 className="min-w-0 text-base font-semibold text-slate-950">{title}</h3>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="mt-4 flex min-h-[132px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
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

function OverviewAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className={cx(adminTheme.secondaryButton, "h-9 min-w-max shrink-0")} onClick={onClick} type="button">
      {label}
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function donutSegments(rows: FinanceSituationSlice[], totalCount: number) {
  const circumference = 2 * Math.PI * 42;
  let offset = 0;
  return rows
    .filter((row) => row.count > 0)
    .map((row) => {
      const percentage = (row.count / totalCount) * 100;
      const length = (row.count / totalCount) * circumference;
      const segment = {
        circumference,
        color: row.color,
        key: row.key,
        length,
        offset: -offset,
        tooltip: `${row.label}\nQuantidade: ${row.count}\nValor: ${formatFinanceCurrency(row.amountCents)}\nPercentual: ${percentage.toFixed(1)}%`,
      };
      offset += length;
      return segment;
    });
}

function formatCompactCurrency(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    compactDisplay: "short",
    currency: "BRL",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(valueCents / 100);
}
