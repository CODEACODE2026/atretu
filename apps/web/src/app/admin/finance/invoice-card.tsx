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

  return (
    <article className={cx(adminTheme.card, adminTheme.cardHover, "min-w-0 overflow-hidden p-4")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge invoice={invoice} />
            <BankSlipStatusBadge bankSlip={bankSlip} />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-normal text-slate-950">{invoice.amountFormatted}</p>
              <h3 className="mt-1 truncate text-base font-semibold text-slate-950">
                {invoice.student.person.fullName}
              </h3>
              <p className="text-sm text-slate-600">{invoice.student.person.cpfMasked}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:text-right">
              <span className="block text-xs font-semibold uppercase text-slate-500">Vencimento</span>
              <span className="font-semibold text-slate-950">{formatDate(invoice.dueDate)}</span>
            </div>
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
          <PrimaryAction
            action={primaryAction}
            busy={busy}
            onIssue={onIssue}
            onPdf={onPdf}
            onSync={onSync}
            onViewError={onViewError}
          />
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onToggleDetails} type="button">
            {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
            {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetaItem label="Descrição" value={invoice.description || "Sem descrição"} />
        <MetaItem
          label="Instituição"
          value={`${invoice.enrollment.institution.name} · ${invoice.enrollment.academicYear.year}`}
        />
        <MetaItem label="Competência" value={`${invoice.enrollment.course} · ${invoice.enrollment.grade} · ${invoice.enrollment.shift.name}`} />
        <MetaItem label="Boleto" value={`${bankSlipInfo.label} · ${bankSlipDisplayNumber(bankSlip)}`} />
        <MetaItem label="Última atualização" value={formatDateTime(invoice.updatedAt)} />
        {bankSlip && isFullBankSlipRecord(bankSlip) && bankSlip.lastCheckedAt ? (
          <MetaItem label="Última consulta" value={formatDateTime(bankSlip.lastCheckedAt)} />
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <SecondaryActions
          bankSlip={bankSlip}
          busy={busy}
          canCancelInvoice={canCancelInvoice}
          canCancelSlip={canCancelSlip}
          onCancelInvoice={onCancelInvoice}
          onCancelSlip={onCancelSlip}
          onCopy={onCopy}
          onSync={onSync}
          onViewError={onViewError}
          primaryAction={primaryAction}
        />
      </div>

      {expanded ? <InvoiceDetails bankSlip={bankSlip} invoice={invoice} /> : null}
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

function PrimaryAction({
  action,
  busy,
  onIssue,
  onPdf,
  onSync,
  onViewError,
}: {
  action: BankSlipPrimaryAction;
  busy: boolean;
  onIssue: () => void;
  onPdf: () => void;
  onSync: () => void;
  onViewError: () => void;
}) {
  if (action === "error") {
    return (
      <button className={adminTheme.primaryButton} disabled={busy} onClick={onViewError} type="button">
        <AlertTriangle aria-hidden="true" className="h-4 w-4" />
        Ver erro
      </button>
    );
  }
  if (action === "issue") {
    return (
      <button className={adminTheme.primaryButton} disabled={busy} onClick={onIssue} type="button">
        <Send aria-hidden="true" className="h-4 w-4" />
        {busy ? "Processando..." : "Emitir boleto"}
      </button>
    );
  }
  if (action === "download") {
    return (
      <button className={adminTheme.primaryButton} disabled={busy} onClick={onPdf} type="button">
        <FileDown aria-hidden="true" className="h-4 w-4" />
        Baixar PDF
      </button>
    );
  }
  if (action === "sync") {
    return (
      <button className={adminTheme.primaryButton} disabled={busy} onClick={onSync} type="button">
        <Search aria-hidden="true" className="h-4 w-4" />
        Consultar boleto
      </button>
    );
  }
  return null;
}

function SecondaryActions({
  bankSlip,
  busy,
  canCancelInvoice,
  canCancelSlip,
  onCancelInvoice,
  onCancelSlip,
  onCopy,
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
  onSync: () => void;
  onViewError: () => void;
  primaryAction: BankSlipPrimaryAction;
}) {
  const hasCopy = isFullBankSlipRecord(bankSlip) && Boolean(bankSlip.linhaDigitavel);
  const hasSync = Boolean(bankSlip) && primaryAction !== "sync";
  const hasError = primaryAction !== "error" && hasBankSlipProviderProblem(bankSlip);
  const hasActions = hasSync || hasCopy || hasError || canCancelSlip || canCancelInvoice;

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
