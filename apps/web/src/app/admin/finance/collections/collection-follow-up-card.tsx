import { CalendarClock, ChevronRight, Clock3 } from "lucide-react";
import type { CollectionCase } from "../../../../lib/api";
import { formatDateTime } from "../../../../lib/formatters/date";
import { adminTheme, cx } from "../../admin-theme";
import { collectionActionTypeLabel } from "../../collection-formatters";
import { CollectionPriorityBadge } from "./collection-priority-badge";
import { CollectionStatusBadge } from "./collection-status-badge";
import { formatOutstanding } from "./collection-display-utils";

export function CollectionFollowUpCard({
  caseItem,
  onOpenDetail,
}: {
  caseItem: CollectionCase;
  onOpenDetail: (invoiceId: string) => void;
}) {
  return (
    <article className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-950">
            {caseItem.student.person.fullName}
          </p>
          <p className="mt-1 break-words text-xs text-slate-500">
            {caseItem.enrollment.institution.name}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <CollectionPriorityBadge priority={caseItem.priority} />
          <CollectionStatusBadge status={caseItem.operationalStatus} />
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Pendente" value={formatOutstanding(caseItem)} />
        <Info
          label="Retorno"
          value={
            caseItem.nextFollowUpAt
              ? formatDateTime(caseItem.nextFollowUpAt)
              : "Nao agendado"
          }
        />
        <Info label="Atraso da fatura" value={`${caseItem.daysOverdue} dia(s)`} />
        <Info
          label="Ultima acao"
          value={
            caseItem.lastAction
              ? collectionActionTypeLabel(caseItem.lastAction.actionType)
              : "Sem historico"
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="h-4 w-4" />
          Follow-up operacional
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 aria-hidden className="h-4 w-4" />
          {caseItem.invoiceId.slice(0, 8)}
        </span>
      </div>

      <div className="flex justify-end">
        <button
          className={cx(adminTheme.secondaryButton, "h-9")}
          onClick={() => onOpenDetail(caseItem.invoiceId)}
          type="button"
        >
          Abrir detalhe
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-950">
        {value}
      </p>
    </div>
  );
}
