import { AlertTriangle, FileDown, MoreHorizontal, ReceiptText, Search, Send, XCircle } from "lucide-react";
import { type InvoiceRecord } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import {
  getBankSlipPrimaryAction,
  hasBankSlipProviderProblem,
  type BankSlipPrimaryAction,
} from "./bank-slip-action-utils";
import {
  isFullBankSlipRecord,
  type BankSlipListRecord,
} from "./finance-display-utils";
import { InvoiceCompactRow } from "./invoice-compact-row";
import { InvoiceDetails } from "./invoice-details";

export function InvoiceCard({
  bankSlip,
  busy,
  canCancelInvoice,
  canCancelSlip,
  canDownloadPdf,
  canIssue,
  canManageActions,
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
  canManageActions: boolean;
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

  return (
    <InvoiceCompactRow
      bankSlip={bankSlip}
      busy={busy}
      expanded={expanded}
      expandedActions={
        canManageActions ? (
          <SecondaryActions
            bankSlip={bankSlip}
            busy={busy}
            canCancelInvoice={canCancelInvoice}
            canCancelSlip={canCancelSlip}
            onCancelInvoice={onCancelInvoice}
            onCancelSlip={onCancelSlip}
            onCopy={onCopy}
            onIssue={onIssue}
            onPdf={onPdf}
            onSync={onSync}
            onViewError={onViewError}
            primaryAction={primaryAction}
          />
        ) : null
      }
      expandedChildren={<InvoiceDetails bankSlip={bankSlip} invoice={invoice} />}
      invoice={invoice}
      leadingAction={
        canManageActions ? (
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
        ) : null
      }
      onToggleDetails={onToggleDetails}
    />
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
  onPdf,
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
  onPdf: () => void;
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
