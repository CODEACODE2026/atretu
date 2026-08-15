"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  MinusCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  api,
  type FinancialMonthlyReport,
  type FinancialReportCategory,
  type FinancialReportComparisonMonth,
  type ManualFinancialMovementCategory,
} from "../../../lib/api";
import { mapApiErrorMessage } from "../../../lib/formatters";
import { adminTheme, cx } from "../admin-theme";

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

export function FinancialReportsPanel() {
  const defaultPeriod = useMemo(() => currentSaoPauloMonth(), []);
  const [month, setMonth] = useState(defaultPeriod.month);
  const [year, setYear] = useState(defaultPeriod.year);
  const [report, setReport] = useState<FinancialMonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadReport();
  }, []);

  async function loadReport(nextMonth = month, nextYear = year) {
    setLoading(true);
    setError("");
    try {
      const response = await api.getFinancialMonthlyReport({
        month: nextMonth,
        year: nextYear,
      });
      setReport(response);
    } catch (caught) {
      setReport(null);
      const message = caught instanceof Error ? caught.message : "";
      setError(mapApiErrorMessage(message) || "Erro ao carregar relatório financeiro");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadReport();
  }

  const summary = report?.summary;

  return (
    <section className="grid min-w-0 gap-4">
      <div className={cx(adminTheme.card, "min-w-0 p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
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
          <form className="grid gap-2 sm:grid-cols-[120px_120px_auto]" onSubmit={submit}>
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
            <button className={adminTheme.primaryButton} disabled={loading} type="submit">
              <RefreshCw aria-hidden="true" className={cx("h-4 w-4", loading ? "animate-spin" : undefined)} />
              Atualizar
            </button>
          </form>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
