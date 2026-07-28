import {
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  Mail,
  Phone,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { CollectionCase } from "../../../../lib/api";
import { formatDate, formatDateTime } from "../../../../lib/formatters/date";
import { adminTheme, cx } from "../../admin-theme";
import {
  collectionActionTypeLabel,
  collectionAgingBucketLabel,
} from "../../collection-formatters";
import { CollectionPriorityBadge } from "./collection-priority-badge";
import { CollectionStatusBadge } from "./collection-status-badge";
import {
  bankSlipDisplay,
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

  return (
    <article
      className={cx(
        adminTheme.card,
        adminTheme.cardHover,
        "grid min-w-0 gap-4 p-4",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-500">
            <UserRound aria-hidden className="h-4 w-4 shrink-0" />
            <span className="truncate">{caseItem.invoiceId.slice(0, 8)}</span>
          </div>
          <h3 className="mt-1 break-words text-base font-semibold tracking-normal text-slate-950">
            {caseItem.student.person.fullName}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-500">
            {caseItem.enrollment.course} / {caseItem.enrollment.grade}
          </p>
          {caseItem.student.guardian?.fullName ? (
            <p className="mt-1 break-words text-xs text-slate-500">
              Resp.: {caseItem.student.guardian.fullName}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CollectionPriorityBadge priority={caseItem.priority} />
          <CollectionStatusBadge status={caseItem.operationalStatus} />
        </div>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={WalletCards}
          label="Original"
          value={caseItem.amountFormatted}
        />
        <Metric
          icon={WalletCards}
          label="Pendente"
          value={formatOutstanding(caseItem)}
        />
        <Metric
          icon={CalendarDays}
          label="Vencimento"
          value={formatDate(caseItem.dueDate)}
        />
        <Metric
          icon={Clock3}
          label="Atraso"
          value={`${caseItem.daysOverdue} dia(s)`}
          detail={collectionAgingBucketLabel(caseItem.agingBucket)}
        />
      </div>

      <div className="grid min-w-0 gap-2 text-sm md:grid-cols-3">
        <InlineInfo
          icon={Phone}
          label="Telefone"
          value={caseItem.student.person.phone ?? "Sem telefone"}
        />
        <InlineInfo
          icon={Mail}
          label="E-mail"
          value={caseItem.student.person.email ?? "Sem e-mail"}
        />
        <InlineInfo
          icon={Building2}
          label="Instituicao"
          value={caseItem.enrollment.institution.name}
          detail={`Ano ${caseItem.enrollment.academicYear.year}`}
        />
      </div>

      <div className="grid min-w-0 gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-sm lg:grid-cols-3">
        <InlineInfo
          icon={Clock3}
          label="Ultima acao"
          value={
            caseItem.lastAction
              ? collectionActionTypeLabel(caseItem.lastAction.actionType)
              : "Sem historico"
          }
          detail={
            caseItem.lastAction
              ? formatDateTime(caseItem.lastAction.createdAt)
              : undefined
          }
        />
        <InlineInfo
          icon={CalendarDays}
          label="Proximo retorno"
          value={
            caseItem.nextFollowUpAt
              ? formatDateTime(caseItem.nextFollowUpAt)
              : "Nao agendado"
          }
        />
        <InlineInfo
          icon={FileText}
          label="Boleto"
          value={bankSlip.label}
          detail={bankSlip.detail}
          valueClassName={bankSlip.tone}
        />
      </div>

      {signals.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {signals.map((signal) => (
            <span
              className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
              key={signal}
            >
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          className={adminTheme.primaryButton}
          onClick={() => onOpenDetail(caseItem.invoiceId)}
          type="button"
        >
          Abrir
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function Metric({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail?: string;
  icon: typeof WalletCards;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon aria-hidden className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function InlineInfo({
  detail,
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  detail?: string;
  icon: typeof WalletCards;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p
          className={cx(
            "break-words text-sm font-medium text-slate-800",
            valueClassName,
          )}
        >
          {value}
        </p>
        {detail ? <p className="break-words text-xs text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}
