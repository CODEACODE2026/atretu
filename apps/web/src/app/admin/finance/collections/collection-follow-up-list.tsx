import { useMemo } from "react";
import { Inbox } from "lucide-react";
import type { CollectionCase } from "../../../../lib/api";
import { adminTheme, cx } from "../../admin-theme";
import { CollectionFollowUpCard } from "./collection-follow-up-card";

export function CollectionFollowUpList({
  cases,
  onOpenDetail,
}: {
  cases: CollectionCase[];
  onOpenDetail: (invoiceId: string) => void;
}) {
  const grouped = useMemo(() => groupFollowUps(cases), [cases]);
  const total = grouped.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className={cx(adminTheme.card, "min-w-0 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Retornos agendados
          </h3>
          <p className="text-xs text-slate-500">
            {total} retorno(s) nos agrupamentos visuais atuais
          </p>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))]">
        {grouped.map((group) => (
          <div
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3"
            key={group.label}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {group.label}
              </p>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                {group.items.length}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {group.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-center">
                  <Inbox aria-hidden className="mx-auto h-5 w-5 text-slate-400" />
                  <p className="mt-1 text-sm text-slate-500">Sem retornos</p>
                </div>
              ) : (
                group.items.slice(0, 5).map((item) => (
                  <CollectionFollowUpCard
                    caseItem={item}
                    key={`${group.label}-${item.invoiceId}`}
                    onOpenDetail={onOpenDetail}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function groupFollowUps(cases: CollectionCase[]) {
  const now = new Date();
  const startToday = startOfDay(now);
  const startTomorrow = addDays(startToday, 1);
  const startAfterTomorrow = addDays(startToday, 2);
  const sevenDays = addDays(startToday, 8);
  return [
    {
      label: "Atrasados",
      items: cases.filter((item) => dateOf(item.nextFollowUpAt) < startToday),
    },
    {
      label: "Hoje",
      items: cases.filter((item) =>
        sameRange(item.nextFollowUpAt, startToday, startTomorrow),
      ),
    },
    {
      label: "Amanha",
      items: cases.filter((item) =>
        sameRange(item.nextFollowUpAt, startTomorrow, startAfterTomorrow),
      ),
    },
    {
      label: "Proximos sete dias",
      items: cases.filter((item) =>
        sameRange(item.nextFollowUpAt, startAfterTomorrow, sevenDays),
      ),
    },
  ];
}

function dateOf(value?: string | null) {
  return value ? new Date(value) : new Date(Number.NaN);
}

function sameRange(value: string | null | undefined, start: Date, end: Date) {
  const date = dateOf(value);
  return date >= start && date < end;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
