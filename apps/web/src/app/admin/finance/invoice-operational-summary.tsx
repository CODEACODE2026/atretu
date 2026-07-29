import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileQuestion,
  ReceiptText,
} from "lucide-react";
import { adminTheme, cx } from "../admin-theme";
import {
  quickFilterLabel,
  type InvoiceOperationalSummary,
  type InvoiceQuickFilter,
} from "./invoice-display-utils";

const items: Array<{
  filter: InvoiceQuickFilter;
  icon: typeof AlertTriangle;
  tone: "danger" | "info" | "neutral" | "success" | "warning";
}> = [
  { filter: "open", icon: ReceiptText, tone: "info" },
  { filter: "overdue", icon: AlertTriangle, tone: "danger" },
  { filter: "dueToday", icon: CalendarClock, tone: "warning" },
  { filter: "upcoming", icon: CalendarDays, tone: "neutral" },
  { filter: "paid", icon: CheckCircle2, tone: "success" },
  { filter: "cancelled", icon: Ban, tone: "neutral" },
  { filter: "withoutSlip", icon: FileQuestion, tone: "info" },
  { filter: "partialReview", icon: CircleDollarSign, tone: "warning" },
];

const toneClass = {
  danger: "border-red-200 bg-red-50/80 text-red-700",
  info: "border-sky-200 bg-sky-50/80 text-sky-700",
  neutral: "border-slate-200 bg-white text-slate-700",
  success: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  warning: "border-amber-200 bg-amber-50/80 text-amber-700",
};

export function InvoiceOperationalSummaryCards({
  activeFilter,
  onSelect,
  summary,
}: {
  activeFilter: InvoiceQuickFilter;
  onSelect: (filter: InvoiceQuickFilter) => void;
  summary: InvoiceOperationalSummary;
}) {
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")} aria-labelledby="invoice-operational-summary-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cx(adminTheme.titleText, "text-base")} id="invoice-operational-summary-title">
            Fila operacional
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Atalhos sobre as faturas carregadas nesta pagina.
          </p>
        </div>
        {activeFilter !== "all" ? (
          <button className={adminTheme.secondaryButton} onClick={() => onSelect("all")} type="button">
            Ver todas
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeFilter === item.filter;
          return (
            <button
              aria-pressed={active}
              className={cx(
                "min-w-0 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15",
                toneClass[item.tone],
                active ? "ring-2 ring-[#1F6F5F]" : "hover:border-[#8DB7AD]",
              )}
              key={item.filter}
              onClick={() => onSelect(item.filter)}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-xs font-semibold uppercase text-slate-500">
                  {quickFilterLabel(item.filter)}
                </span>
                <Icon aria-hidden className="h-4 w-4 shrink-0" />
              </span>
              <span className="mt-2 block text-xl font-bold text-slate-950">
                {summaryValue(summary, item.filter)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function summaryValue(
  summary: InvoiceOperationalSummary,
  filter: InvoiceQuickFilter,
) {
  if (filter === "cancelled") return summary.cancelled;
  if (filter === "dueToday") return summary.dueToday;
  if (filter === "open") return summary.open;
  if (filter === "overdue") return summary.overdue;
  if (filter === "paid") return summary.paid;
  if (filter === "partialReview") return summary.partialReview;
  if (filter === "upcoming") return summary.upcoming;
  if (filter === "withoutSlip") return summary.withoutSlip;
  return 0;
}
