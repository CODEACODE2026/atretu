import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { CollectionCase } from "../../../../lib/api";
import { formatDate } from "../../../../lib/formatters/date";
import { adminTheme, cx } from "../../admin-theme";
import { collectionAgingBucketLabel } from "../../collection-formatters";
import { CollectionPriorityBadge } from "./collection-priority-badge";
import { CollectionStatusBadge } from "./collection-status-badge";
import {
  bankSlipDisplay,
  collectionFollowUpState,
  collectionRiskSignals,
  formatOutstanding,
} from "./collection-display-utils";

export function CollectionCard({
  caseItem,
  onOpenDetail,
}: {
  caseItem: CollectionCase;
  onOpenDetail: (invoiceId: string) => void;
}) {
  const bankSlip = bankSlipDisplay(caseItem);
  const signals = collectionRiskSignals(caseItem);
  const followUp = compactFollowUp(caseItem.nextFollowUpAt);
  const openDetail = () => onOpenDetail(caseItem.invoiceId);

  return (
    <article
      className="grid min-w-0 cursor-pointer gap-3 border-b border-slate-100 bg-white px-3 py-3 text-sm transition last:border-b-0 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6F5F] focus-visible:ring-offset-2 xl:grid-cols-[minmax(9rem,1.5fr)_minmax(8rem,1fr)_6.5rem_6.5rem_5.5rem_5.75rem_minmax(8rem,1.15fr)_6.75rem_5.75rem_5rem] xl:items-center"
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="min-w-0">
        <span className="block truncate font-semibold text-slate-950">
          {caseItem.student.person.fullName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {caseItem.student.person.cpfMasked} · {caseItem.invoiceId.slice(0, 8)}
        </span>
      </div>

      <CompactCell label="Instituição">
        <span className="block truncate text-slate-700">
          {caseItem.enrollment.institution.name}
        </span>
        <span className="block truncate text-xs text-slate-500">
          Ano {caseItem.enrollment.academicYear.year}
        </span>
      </CompactCell>

      <CompactCell label="Pendente">
        <span className="font-semibold text-slate-950">
          {formatOutstanding(caseItem)}
        </span>
        <span className="block text-xs text-slate-500">
          orig. {caseItem.amountFormatted}
        </span>
      </CompactCell>

      <CompactCell label="Vencimento">
        <span className="font-medium text-slate-800">
          {formatDate(caseItem.dueDate)}
        </span>
      </CompactCell>

      <CompactCell label="Atraso">
        <span className="font-medium text-slate-800">
          {caseItem.daysOverdue} dias
        </span>
        <span className="block text-xs text-slate-500">
          {collectionAgingBucketLabel(caseItem.agingBucket)}
        </span>
      </CompactCell>

      <CompactCell label="Prioridade">
        <CollectionPriorityBadge priority={caseItem.priority} />
      </CompactCell>

      <CompactCell label="Status">
        <div className="flex min-w-0 items-center gap-1.5">
          <CollectionStatusBadge status={caseItem.operationalStatus} />
          {signals.length > 0 ? (
            <span
              aria-label={`Sinais adicionais: ${signals.join(", ")}`}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600"
              title={signals.join(", ")}
            >
              +{signals.length}
            </span>
          ) : null}
        </div>
      </CompactCell>

      <CompactCell label="Próximo retorno">
        <span
          className={cx(
            "font-medium",
            followUp.state === "OVERDUE" ? "text-red-700" : "text-slate-800",
          )}
          title={caseItem.nextFollowUpAt ?? undefined}
        >
          {followUp.label}
        </span>
      </CompactCell>

      <CompactCell label="Boleto">
        <span className={cx("font-semibold", bankSlip.tone)} title={bankSlip.detail}>
          {bankSlip.label}
        </span>
      </CompactCell>

      <div className="flex justify-end lg:justify-start">
        <button
          className={cx(adminTheme.primaryButton, "min-h-9 px-3 py-1.5 text-xs")}
          onClick={(event) => {
            event.stopPropagation();
            openDetail();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          type="button"
        >
          Abrir
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function CompactCell({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] items-start gap-2 xl:block">
      <span className="text-xs font-semibold uppercase text-slate-500 xl:hidden">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function compactFollowUp(value?: string | null) {
  const state = collectionFollowUpState(value);
  if (!value) {
    return { label: "Não agendado", state };
  }

  const target = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(target);

  if (targetDay.getTime() === today.getTime()) {
    return { label: `Hoje, ${time}`, state };
  }
  if (targetDay.getTime() === tomorrow.getTime()) {
    return { label: "Amanhã", state };
  }
  return {
    label: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(target),
    state,
  };
}
