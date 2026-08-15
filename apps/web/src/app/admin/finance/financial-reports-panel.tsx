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
      downloadReportPdf(toGeneratedReport(response), user);
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
        <>
          <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
            <div className="border-b border-slate-200/80 px-4 py-4">
              <h3 className="text-base font-semibold text-slate-950">
                Comparativo dos últimos 12 meses
              </h3>
            </div>
            <div className="overflow-x-auto">
              <div className="grid min-w-[760px] gap-2 p-4">
                {report.comparison.map((month) => (
                  <ComparisonRow key={month.month} row={month} />
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <CategoryTable
              empty="Nenhuma despesa paga no período."
              rows={report.expenseCategories}
              showPercentage
              title="Despesas por categoria"
            />
            <CategoryTable
              empty="Nenhuma entrada manual recebida no período."
              rows={report.incomeCategories}
              title="Entradas manuais por categoria"
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function toGeneratedReport(report: FinancialMonthlyReport): GeneratedReport {
  return {
    category: "Financeiro",
    columns: [
      { key: "section", label: "Seção" },
      { key: "item", label: "Item" },
      { key: "revenue", label: "Receita" },
      { key: "expense", label: "Despesa" },
      { key: "result", label: "Resultado" },
      { key: "detail", label: "Detalhe" },
    ],
    filters: [
      { label: "Associação", value: ASSOCIATION_NAME },
      { label: "Período", value: report.period.label },
      { label: "Fuso", value: report.period.timezone },
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
      detail: `Período ${report.period.startDate} até ${report.period.endDateExclusive}`,
      expense: "",
      item: "Receita de mensalidades",
      result: "",
      revenue: report.summary.invoiceRevenueFormatted,
      section: "Resumo do período",
    },
    {
      detail: report.rules.manualIncomeDate,
      expense: "",
      item: "Outras entradas",
      result: "",
      revenue: report.summary.manualIncomeFormatted,
      section: "Resumo do período",
    },
    {
      detail: "Receita de mensalidades + outras entradas",
      expense: "",
      item: "Receita total",
      result: "",
      revenue: report.summary.totalRevenueFormatted,
      section: "Resumo do período",
    },
    {
      detail: report.rules.manualExpenseDate,
      expense: report.summary.expenseFormatted,
      item: "Despesas",
      result: "",
      revenue: "",
      section: "Resumo do período",
    },
    {
      detail: "Receita total - despesas",
      expense: "",
      item: "Resultado",
      result: `${report.summary.resultStatus === "NEGATIVE" ? "-" : "+"} ${report.summary.resultFormatted}`,
      revenue: "",
      section: "Resumo do período",
    },
  ];
}

function comparisonRows(rows: FinancialReportComparisonMonth[]): ReportRow[] {
  return rows.map((row) => ({
    detail: `Competência ${row.month}`,
    expense: row.expenseFormatted,
    item: row.label,
    result: `${row.resultStatus === "NEGATIVE" ? "-" : "+"} ${row.resultFormatted}`,
    revenue: row.revenueFormatted,
    section: "Comparativo dos últimos 12 meses",
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
        detail: "Nenhum registro encontrado.",
        expense: "",
        item: section,
        result: "",
        revenue: "",
        section,
      },
    ];
  }
  return rows.map((row) => ({
    detail: `${row.count} lançamento(s) · ${row.percentage.toFixed(2)}%`,
    expense: target === "expense" ? row.totalFormatted : "",
    item: categoryLabels[row.category],
    result: "",
    revenue: target === "revenue" ? row.totalFormatted : "",
    section,
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
          <p className="mt-2 truncate text-2xl font-semibold text-slate-950">
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

function ComparisonRow({ row }: { row: FinancialReportComparisonMonth }) {
  const max = Math.max(row.revenueCents, row.expenseCents, 1);
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[120px_1fr_110px] md:items-center">
      <div className="text-sm font-semibold capitalize text-slate-700">{row.label}</div>
      <div className="grid gap-2">
        <Bar label="Receita" tone="positive" value={row.revenueCents} width={(row.revenueCents / max) * 100} />
        <Bar label="Despesa" tone="negative" value={row.expenseCents} width={(row.expenseCents / max) * 100} />
      </div>
      <div className={cx("text-sm font-semibold", row.resultStatus === "NEGATIVE" ? "text-red-700" : "text-emerald-700")}>
        {row.resultStatus === "NEGATIVE" ? "-" : "+"} {row.resultFormatted}
      </div>
    </div>
  );
}

function Bar({
  label,
  tone,
  value,
  width,
}: {
  label: string;
  tone: "positive" | "negative";
  value: number;
  width: number;
}) {
  return (
    <div className="grid grid-cols-[70px_1fr_110px] items-center gap-2 text-xs text-slate-600">
      <span>{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100">
        <span
          className={cx("block h-full rounded-full", tone === "positive" ? "bg-[#1F6F5F]" : "bg-red-500")}
          style={{ width: `${Math.max(width, value > 0 ? 3 : 0)}%` }}
        />
      </span>
      <span className="text-right font-semibold text-slate-700">{formatCurrency(value)}</span>
    </div>
  );
}

function CategoryTable({
  empty,
  rows,
  showPercentage,
  title,
}: {
  empty: string;
  rows: FinancialReportCategory[];
  showPercentage?: boolean;
  title: string;
}) {
  return (
    <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
      <div className="border-b border-slate-200/80 px-4 py-4">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
          <MinusCircle aria-hidden="true" className="h-4 w-4" />
          {empty}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-right">Qtd.</th>
                <th className="px-4 py-3 text-right">Total</th>
                {showPercentage ? <th className="px-4 py-3 text-right">%</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.category}>
                  <td className="px-4 py-3 font-medium text-slate-800">{categoryLabels[row.category]}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{row.count}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{row.totalFormatted}</td>
                  {showPercentage ? <td className="px-4 py-3 text-right text-slate-600">{row.percentage.toFixed(2)}%</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
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
