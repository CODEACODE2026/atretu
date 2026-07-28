import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  ReceiptText,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { CollectionSummary } from "../../../../lib/api";
import { adminTheme, cx } from "../../admin-theme";
import { collectionAgingBucketLabel } from "../../collection-formatters";
import {
  collectionAgingBuckets,
  formatCents,
} from "./collection-display-utils";

export function CollectionSummaryCards({
  summary,
}: {
  summary: CollectionSummary | null;
}) {
  const cards = [
    {
      label: "Valor vencido",
      value: formatCents(summary?.totalOverdueCents),
      icon: CircleDollarSign,
      tone: "text-[#0F2E2E] bg-[#E8F3F0]",
    },
    {
      label: "Faturas",
      value: String(summary?.invoiceCount ?? 0),
      icon: ReceiptText,
      tone: "text-blue-700 bg-blue-50",
    },
    {
      label: "Alunos",
      value: String(summary?.studentCount ?? 0),
      icon: UsersRound,
      tone: "text-cyan-700 bg-cyan-50",
    },
    {
      label: "Ticket medio",
      value: formatCents(summary?.averageOverdueAmountCents),
      icon: WalletCards,
      tone: "text-slate-700 bg-slate-100",
    },
    {
      label: "Promessas ativas",
      value: String(summary?.promisesActiveCount ?? 0),
      icon: CalendarClock,
      tone: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Promessas vencidas",
      value: String(summary?.promisesBrokenCount ?? 0),
      icon: AlertTriangle,
      tone: "text-red-700 bg-red-50",
    },
    {
      label: "Retornos hoje",
      value: String(summary?.followUpsTodayCount ?? 0),
      icon: CalendarClock,
      tone: "text-amber-700 bg-amber-50",
    },
    {
      label: "Pagamentos parciais",
      value: String(summary?.partialPaymentReviewCount ?? 0),
      icon: AlertTriangle,
      tone: "text-purple-700 bg-purple-50",
    },
  ];

  return (
    <div className="mt-5 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ icon: Icon, label, tone, value }) => (
          <div className={cx(adminTheme.softPanel, "min-w-0 p-3")} key={label}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-500">
                  {label}
                </p>
                <p className="mt-1 break-words text-xl font-semibold tracking-normal text-slate-950">
                  {value}
                </p>
              </div>
              <span
                className={cx(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                  tone,
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {collectionAgingBuckets.map((bucket) => (
          <div
            className="min-w-0 rounded-lg border border-slate-200/80 bg-white px-3 py-2"
            key={bucket}
          >
            <p className="text-xs font-medium uppercase text-slate-500">
              {collectionAgingBucketLabel(bucket)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {summary?.agingBuckets[bucket] ?? 0} fatura(s)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
