import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type InvoiceRecord } from "../../../lib/api";
import { formatDate } from "../../../lib/formatters/date";
import { adminTheme, cx } from "../admin-theme";
import {
  bankSlipDisplayNumber,
  bankSlipPresentation,
  type BankSlipListRecord,
} from "./finance-display-utils";
import { BankSlipStatusBadge, InvoiceStatusBadge } from "./invoice-status-badge";
import {
  invoiceOperationalLabel,
  invoiceOperationalTone,
} from "./invoice-display-utils";

export function InvoiceCompactRow({
  bankSlip,
  busy,
  expanded,
  expandedActions,
  expandedChildren,
  invoice,
  leadingAction,
  onToggleDetails,
  showStudent = true,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
  busy: boolean;
  expanded: boolean;
  expandedActions?: ReactNode;
  expandedChildren?: ReactNode;
  invoice: InvoiceRecord;
  leadingAction?: ReactNode;
  onToggleDetails: () => void;
  showStudent?: boolean;
}) {
  const bankSlipInfo = bankSlipPresentation(bankSlip);
  const operationalTone = invoiceOperationalTone(invoice, bankSlip);
  const operationalLabel = invoiceOperationalLabel(invoice, bankSlip);
  const context = showStudent
    ? {
        detail: invoice.student.person.cpfMasked,
        label: "Acadêmico",
        value: invoice.student.person.fullName,
      }
    : null;

  return (
    <article
      className={cx(
        adminTheme.card,
        adminTheme.cardHover,
        "min-w-0 overflow-hidden border-l-4 p-4",
        toneBorderClass(operationalTone),
      )}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cx(
                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                tonePillClass(operationalTone),
              )}
            >
              {operationalLabel}
            </span>
            <InvoiceStatusBadge invoice={invoice} />
            <BankSlipStatusBadge bankSlip={bankSlip} />
          </div>

          <div
            className={cx(
              "grid min-w-0 gap-3 sm:grid-cols-2",
              showStudent ? "xl:grid-cols-[minmax(12rem,1.5fr)_repeat(4,minmax(0,1fr))]" : "lg:grid-cols-4",
            )}
          >
            {context ? (
              <CompactMetric
                detail={context.detail}
                label={context.label}
                value={context.value}
              />
            ) : null}
            <CompactMetric emphasis label="Valor" value={invoice.amountFormatted} />
            <CompactMetric label="Vencimento" value={formatDate(invoice.dueDate)} />
            <CompactMetric label="Competência" value={formatMonthYear(invoice.dueDate)} />
            <CompactMetric
              detail={bankSlipDisplayNumber(bankSlip)}
              label="Boleto"
              value={bankSlipInfo.label}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:max-w-md lg:justify-end">
          {leadingAction}
          <button
            className={adminTheme.secondaryButton}
            aria-expanded={expanded}
            disabled={busy}
            onClick={onToggleDetails}
            type="button"
          >
            {expanded ? (
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            )}
            {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          {expandedActions ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {expandedActions}
            </div>
          ) : null}
          {expandedChildren}
        </>
      ) : null}
    </article>
  );
}

function CompactMetric({
  detail,
  emphasis = false,
  label,
  value,
}: {
  detail?: string | null;
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p
        className={cx(
          "mt-1 truncate font-semibold text-slate-950",
          emphasis ? "text-base" : "text-sm",
        )}
      >
        {value || "-"}
      </p>
      {detail ? <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function formatMonthYear(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
}

function toneBorderClass(tone: string) {
  if (tone === "danger") return "border-l-red-500";
  if (tone === "warning") return "border-l-amber-400";
  if (tone === "success") return "border-l-emerald-500";
  if (tone === "info") return "border-l-sky-400";
  return "border-l-slate-300";
}

function tonePillClass(tone: string) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "info") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}
