import { AlertTriangle, CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";
import { adminTheme, cx } from "../admin-theme";
import { formatFinanceCurrency, type FinanceSummary } from "./finance-display-utils";

const toneClass = {
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function FinanceSummaryCards({
  loading = false,
  summary,
}: {
  loading?: boolean;
  summary: FinanceSummary;
}) {
  const isFilteredSummary = summary.scope === "filtered";
  const displayValue = (value: string) => (loading ? "..." : value);
  const items = [
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
      label: isFilteredSummary ? "Faturas filtradas" : "Faturas carregadas",
      tone: "neutral" as const,
      value: displayValue(
        String(
          isFilteredSummary
            ? summary.totalFilteredInvoiceCount
            : summary.loadedInvoiceCount,
        ),
      ),
    },
    {
      icon: ReceiptText,
      label: "Itens nesta pagina",
      tone: "neutral" as const,
      value: displayValue(String(summary.loadedInvoiceCount)),
    },
    {
      icon: CircleDollarSign,
      label: "Total cancelado",
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

  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")} aria-labelledby="finance-summary-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cx(adminTheme.titleText, "text-base")} id="finance-summary-title">
            Resumo financeiro
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {loading
              ? "Atualizando totais para os filtros atuais."
              : isFilteredSummary
              ? "Totais de todas as faturas correspondentes aos filtros atuais."
              : "Totais das faturas carregadas nesta pagina enquanto o resumo global nao esta disponivel."}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div className={cx("rounded-xl border p-4", toneClass[item.tone])} key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-950">{item.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
