import { AlertTriangle, ChevronDown, ChevronUp, FileDown, MoreHorizontal, ReceiptText, Search, Send, XCircle } from "lucide-react";
import { type InvoiceRecord } from "../../../lib/api";
import { formatDate, formatDateTime } from "../../../lib/formatters/date";
import { adminTheme, cx } from "../admin-theme";
import {
  getBankSlipPrimaryAction,
  hasBankSlipProviderProblem,
  type BankSlipPrimaryAction,
} from "./bank-slip-action-utils";
import {
  bankSlipDisplayNumber,
  bankSlipPresentation,
  isFullBankSlipRecord,
  type BankSlipListRecord,
} from "./finance-display-utils";
import { InvoiceDetails } from "./invoice-details";
import { BankSlipStatusBadge, InvoiceStatusBadge } from "./invoice-status-badge";
import {
  invoiceOperationalLabel,
  invoiceOperationalTone,
} from "./invoice-display-utils";

export function InvoiceCard({
  bankSlip,
  busy,
  canCancelInvoice,
  canCancelSlip,
  canDownloadPdf,
  canIssue,
  checked,
  expanded,
  invoice,
  onCancelInvoice,
  onCancelSlip,
  onCopy,
  onIssue,
  onPdf,
  onSelect,
  onSync,
  onToggleDetails,
  onViewError,
  saving,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
  busy: boolean;
  canCancelInvoice: boolean;
  canCancelSlip: boolean;
  canDownloadPdf: boolean;
  canIssue: boolean;
  checked: boolean;
  expanded: boolean;
  invoice: InvoiceRecord;
  onCancelInvoice: () => void;
  onCancelSlip: () => void;
  onCopy: () => void;
  onIssue: () => void;
  onPdf: () => void;
  onSelect: () => void;
  onSync: () => void;
  onToggleDetails: () => void;
  onViewError: () => void;
  saving: boolean;
}) {
  const canSelect = canIssue && !saving;
  const primaryAction = getBankSlipPrimaryAction({ bankSlip, canDownloadPdf, canIssue });
  const bankSlipInfo = bankSlipPresentation(bankSlip);
  const operationalTone = invoiceOperationalTone(invoice, bankSlip);
  const operationalLabel = invoiceOperationalLabel(invoice, bankSlip);

  return (
    <article className={cx(adminTheme.card, adminTheme.cardHover, "min-w-0 overflow-hidden border-l-4 p-3", toneBorderClass(operationalTone))}>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx("rounded-full border px-2.5 py-1 text-xs font-semibold", tonePillClass(operationalTone))}>
              {operationalLabel}
            </span>
            <InvoiceStatusBadge invoice={invoice} />
            <BankSlipStatusBadge bankSlip={bankSlip} />
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-xl font-bold tracking-normal text-slate-950">{invoice.amountFormatted}</p>
                <p className="text-sm font-semibold text-slate-700">Vence {formatDate(invoice.dueDate)}</p>
              </div>
              <h3 className="mt-1 truncate text-sm font-semibold text-slate-950">
                {invoice.student.person.fullName}
              </h3>
              <p className="truncate text-xs text-slate-600">
                {invoice.student.person.cpfMasked} · {invoice.enrollment.institution.name} · {invoice.enrollment.academicYear.year}
              </p>
            </div>
            <p className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="block font-semibold text-slate-950">{invoice.enrollment.course} · {invoice.enrollment.grade}</span>
              <span className="block truncate">{invoice.enrollment.shift.name}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              checked={checked}
              className="h-4 w-4 rounded border-slate-300 text-[#0F2E2E] focus:ring-[#1F6F5F]"
              disabled={!canSelect}
              onChange={onSelect}
              type="checkbox"
            />
            Selecionar
          </label>
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onToggleDetails} type="button">
            {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
            {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
          {primaryAction === "download" ? (
            <button className={adminTheme.primaryButton} disabled={busy} onClick={onPdf} type="button">
              <FileDown aria-hidden="true" className="h-4 w-4" />
              Baixar PDF
            </button>
          ) : null}
          {primaryAction === "error" ? (
            <button className={adminTheme.primaryButton} disabled={busy} onClick={onViewError} type="button">
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              Ver erro
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <SecondaryActions
          bankSlip={bankSlip}
          busy={busy}
          canCancelInvoice={canCancelInvoice}
          canCancelSlip={canCancelSlip}
          onCancelInvoice={onCancelInvoice}
          onCancelSlip={onCancelSlip}
          onCopy={onCopy}
          onIssue={onIssue}
          onSync={onSync}
          onViewError={onViewError}
          primaryAction={primaryAction}
        />
      </div>

      {expanded ? (
        <>
          <div className="mt-3 grid min-w-0 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
            <MetaItem label="Descrição" value={invoice.description || "Sem descrição"} />
            <MetaItem label="Boleto" value={`${bankSlipInfo.label} · ${bankSlipDisplayNumber(bankSlip)}`} />
            <MetaItem label="Última atualização" value={formatDateTime(invoice.updatedAt)} />
            {bankSlip && isFullBankSlipRecord(bankSlip) && bankSlip.lastCheckedAt ? (
              <MetaItem label="Última consulta" value={formatDateTime(bankSlip.lastCheckedAt)} />
            ) : null}
          </div>
          <InvoiceDetails bankSlip={bankSlip} invoice={invoice} />
        </>
      ) : null}
    </article>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 text-sm text-slate-700">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="block truncate font-medium text-slate-950">{value}</span>
    </p>
  );
}

function SecondaryActions({
  bankSlip,
  busy,
  canCancelInvoice,
  canCancelSlip,
  onCancelInvoice,
  onCancelSlip,
  onCopy,
  onIssue,
  onSync,
  onViewError,
  primaryAction,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
  busy: boolean;
  canCancelInvoice: boolean;
  canCancelSlip: boolean;
  onCancelInvoice: () => void;
  onCancelSlip: () => void;
  onCopy: () => void;
  onIssue: () => void;
  onSync: () => void;
  onViewError: () => void;
  primaryAction: BankSlipPrimaryAction;
}) {
  const hasCopy = isFullBankSlipRecord(bankSlip) && Boolean(bankSlip.linhaDigitavel);
  const hasSync = Boolean(bankSlip) && primaryAction !== "sync";
  const hasError = primaryAction !== "error" && hasBankSlipProviderProblem(bankSlip);
  const hasIssue = primaryAction === "issue";
  const hasPrimarySync = primaryAction === "sync";
  const hasActions = hasIssue || hasPrimarySync || hasSync || hasCopy || hasError || canCancelSlip || canCancelInvoice;

  if (!hasActions) {
    return null;
  }

  return (
    <details className="group w-full sm:w-auto">
      <summary className={cx(adminTheme.secondaryButton, "w-full cursor-pointer list-none sm:w-auto [&::-webkit-details-marker]:hidden")}>
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        Mais ações
      </summary>
      <div className="mt-2 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:min-w-56">
        {hasIssue ? (
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onIssue} type="button">
            <Send aria-hidden="true" className="h-4 w-4" />
            Emitir boleto
          </button>
        ) : null}
        {hasPrimarySync ? (
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onSync} type="button">
            <Search aria-hidden="true" className="h-4 w-4" />
            Consultar boleto
          </button>
        ) : null}
        {hasSync ? (
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onSync} type="button">
            <Search aria-hidden="true" className="h-4 w-4" />
            Consultar boleto
          </button>
        ) : null}
        {hasError ? (
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onViewError} type="button">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            Ver erro do provedor
          </button>
        ) : null}
        {hasCopy ? (
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onCopy} type="button">
            <ReceiptText aria-hidden="true" className="h-4 w-4" />
            Copiar linha
          </button>
        ) : null}
        {canCancelSlip ? (
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onCancelSlip} type="button">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            Solicitar baixa
          </button>
        ) : null}
        {canCancelInvoice ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={busy}
            onClick={onCancelInvoice}
            type="button"
          >
            <XCircle aria-hidden="true" className="h-4 w-4" />
            Cancelar fatura
          </button>
        ) : null}
      </div>
    </details>
  );
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
