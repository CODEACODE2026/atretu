import { FileText } from "lucide-react";
import { type InvoiceRecord } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { type BankSlipListRecord } from "./finance-display-utils";
import { InvoiceCard } from "./invoice-card";

export function InvoiceList({
  bankSlipAction,
  bankSlips,
  canCancelInvoice,
  canCancelSlip,
  canDownloadPdf,
  canIssue,
  expandedInvoiceId,
  hasActiveFilters,
  invoices,
  loading,
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
  selectedInvoiceIds,
}: {
  bankSlipAction: string;
  bankSlips: Record<string, BankSlipListRecord | null | undefined>;
  canCancelInvoice: (invoice: InvoiceRecord, bankSlip: BankSlipListRecord | null | undefined) => boolean;
  canCancelSlip: (invoice: InvoiceRecord, bankSlip: BankSlipListRecord | null | undefined) => boolean;
  canDownloadPdf: (bankSlip: BankSlipListRecord | null | undefined) => boolean;
  canIssue: (invoice: InvoiceRecord, bankSlip: BankSlipListRecord | null | undefined) => boolean;
  expandedInvoiceId: string;
  hasActiveFilters: boolean;
  invoices: InvoiceRecord[];
  loading: boolean;
  onCancelInvoice: (invoice: InvoiceRecord) => void;
  onCancelSlip: (invoice: InvoiceRecord) => void;
  onCopy: (invoiceId: string) => void;
  onIssue: (invoice: InvoiceRecord) => void;
  onPdf: (invoice: InvoiceRecord) => void;
  onSelect: (invoiceId: string) => void;
  onSync: (invoice: InvoiceRecord) => void;
  onToggleDetails: (invoice: InvoiceRecord) => void;
  onViewError: (invoice: InvoiceRecord) => void;
  saving: boolean;
  selectedInvoiceIds: string[];
}) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className={cx(adminTheme.card, "min-w-0 animate-pulse p-4")} key={index}>
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-48 rounded bg-slate-200" />
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="h-10 rounded bg-slate-100" />
              <div className="h-10 rounded bg-slate-100" />
              <div className="h-10 rounded bg-slate-100" />
              <div className="h-10 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className={cx(adminTheme.softPanel, "grid min-w-0 place-items-center px-4 py-10 text-center")}>
        <FileText aria-hidden="true" className="h-10 w-10 text-slate-400" />
        <h3 className="mt-3 text-base font-semibold text-slate-950">
          {hasActiveFilters ? "Nenhuma fatura encontrada" : "Ainda não há faturas"}
        </h3>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          {hasActiveFilters
            ? "Ajuste os filtros ou limpe a busca para visualizar outros resultados."
            : "Crie uma nova fatura para começar o acompanhamento financeiro."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      {invoices.map((invoice) => {
        const bankSlip = bankSlips[invoice.id];
        return (
          <InvoiceCard
            bankSlip={bankSlip}
            busy={bankSlipAction === invoice.id || saving}
            canCancelInvoice={canCancelInvoice(invoice, bankSlip)}
            canCancelSlip={canCancelSlip(invoice, bankSlip)}
            canDownloadPdf={canDownloadPdf(bankSlip)}
            canIssue={canIssue(invoice, bankSlip)}
            checked={selectedInvoiceIds.includes(invoice.id)}
            expanded={expandedInvoiceId === invoice.id}
            invoice={invoice}
            key={invoice.id}
            onCancelInvoice={() => onCancelInvoice(invoice)}
            onCancelSlip={() => onCancelSlip(invoice)}
            onCopy={() => onCopy(invoice.id)}
            onIssue={() => onIssue(invoice)}
            onPdf={() => onPdf(invoice)}
            onSelect={() => onSelect(invoice.id)}
            onSync={() => onSync(invoice)}
            onToggleDetails={() => onToggleDetails(invoice)}
            onViewError={() => onViewError(invoice)}
            saving={saving}
          />
        );
      })}
    </div>
  );
}
