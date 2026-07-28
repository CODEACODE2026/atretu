import { AlertTriangle, CheckCircle2, Clock3, Loader2, ReceiptText, RotateCcw } from "lucide-react";
import { adminTheme, cx } from "../admin-theme";
import { type BatchSummary } from "./batch-display-utils";

const toneClass = {
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function BatchSummaryCards({ summary }: { summary: BatchSummary }) {
  const items = [
    {
      icon: Loader2,
      label: "Em processamento",
      tone: summary.processingBatches > 0 ? ("warning" as const) : ("neutral" as const),
      value: summary.processingBatches,
    },
    {
      icon: Clock3,
      label: "Aguardando",
      tone: summary.queuedBatches > 0 ? ("warning" as const) : ("neutral" as const),
      value: summary.queuedBatches,
    },
    {
      icon: CheckCircle2,
      label: "Concluídos",
      tone: "success" as const,
      value: summary.completedBatches,
    },
    {
      icon: AlertTriangle,
      label: "Parciais/Falhos",
      tone: summary.partialBatches + summary.failedBatches > 0 ? ("danger" as const) : ("neutral" as const),
      value: summary.partialBatches + summary.failedBatches,
    },
    {
      icon: ReceiptText,
      label: "Boletos emitidos",
      tone: "success" as const,
      value: summary.issuedItems,
    },
    {
      icon: RotateCcw,
      label: "Falhas seguras",
      tone: summary.failedItems > 0 ? ("danger" as const) : ("neutral" as const),
      value: summary.failedItems,
    },
  ];

  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")} aria-labelledby="batch-summary-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cx(adminTheme.titleText, "text-base")} id="batch-summary-title">
            Resumo dos lotes
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Visão operacional dos lotes carregados no Financeiro.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {summary.totalBatches} lote(s)
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div className={cx("rounded-xl border p-4", toneClass[item.tone])} key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{item.label}</p>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-950">{item.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
