import {
  type BankSlipIssueBatch,
  type InvoiceListSummary,
  type BankSlipRecord,
  type BankSlipStatus,
  type BankSlipSummary,
  type InvoiceRecord,
  type InvoiceStatus,
} from "../../../lib/api";

export type FinanceArea = "overview" | "invoices" | "batches" | "collections";
export type BankSlipListRecord = BankSlipRecord | BankSlipSummary;
export type BadgeTone = "danger" | "info" | "neutral" | "success" | "warning";

export type FinanceSummary = Pick<
  InvoiceListSummary,
  | "cancelledAmountCents"
  | "failedBankSlips"
  | "loadedInvoiceCount"
  | "openAmountCents"
  | "overdueAmountCents"
  | "paidAmountCents"
  | "totalFilteredInvoiceCount"
> & {
  processingBatches: number;
  scope: "filtered" | "loaded";
};

export function calculateFinanceSummary(
  invoices: InvoiceRecord[],
  bankSlips: Record<string, BankSlipListRecord | null | undefined>,
  currentBatch: BankSlipIssueBatch | null,
): FinanceSummary {
  return invoices.reduce<FinanceSummary>(
    (summary, invoice) => {
      const bankSlip = bankSlips[invoice.id] ?? invoice.bankSlipSummary;
      const amount = invoice.amountCents;

      summary.loadedInvoiceCount += 1;
      summary.totalFilteredInvoiceCount += 1;
      if (invoice.status === "OPEN") {
        summary.openAmountCents += amount;
      }
      if (invoice.status === "OPEN" && invoice.overdue) {
        summary.overdueAmountCents += amount;
      }
      if (invoice.status === "PAID") {
        summary.paidAmountCents += amount;
      }
      if (invoice.status === "CANCELLED") {
        summary.cancelledAmountCents += amount;
      }
      if (bankSlip && isFailedBankSlipStatus(bankSlip.status)) {
        summary.failedBankSlips += 1;
      }
      return summary;
    },
    {
      openAmountCents: 0,
      overdueAmountCents: 0,
      paidAmountCents: 0,
      cancelledAmountCents: 0,
      loadedInvoiceCount: 0,
      totalFilteredInvoiceCount: 0,
      failedBankSlips: 0,
      processingBatches: currentBatch && isBatchProcessing(currentBatch) ? 1 : 0,
      scope: "loaded",
    },
  );
}

export function hasActiveFinanceFilters(filters: {
  academicYearId: string;
  dueDateFrom: string;
  dueDateTo: string;
  institutionId: string;
  overdue: "all" | "overdue" | "notOverdue";
  search: string;
  status: InvoiceStatus | "";
}) {
  return Boolean(
    filters.search ||
      filters.academicYearId ||
      filters.institutionId ||
      filters.status ||
      filters.overdue !== "all" ||
      filters.dueDateFrom ||
      filters.dueDateTo,
  );
}

export function formatFinanceCurrency(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(valueCents / 100);
}

export function invoicePresentation(invoice: InvoiceRecord): {
  label: string;
  tone: BadgeTone;
} {
  if (invoice.status === "PAID") {
    return { label: "Paga", tone: "success" };
  }
  if (invoice.status === "CANCELLED") {
    return { label: "Cancelada", tone: "neutral" };
  }
  if (invoice.overdue) {
    return { label: "Vencida", tone: "danger" };
  }
  return { label: "Aberta", tone: "info" };
}

export function bankSlipPresentation(
  bankSlip: BankSlipListRecord | null | undefined,
): {
  label: string;
  tone: BadgeTone;
} {
  if (bankSlip === undefined) {
    return { label: "Carregando boleto", tone: "neutral" };
  }
  if (!bankSlip) {
    return { label: "Sem boleto", tone: "neutral" };
  }
  const labels: Record<BankSlipStatus, { label: string; tone: BadgeTone }> = {
    CANCELLED: { label: "Boleto baixado", tone: "neutral" },
    CANCELLATION_FAILED: { label: "Boleto com erro", tone: "danger" },
    ISSUE_FAILED: { label: "Boleto com erro", tone: "danger" },
    ISSUED: { label: "Boleto emitido", tone: "info" },
    PAID: { label: "Boleto pago", tone: "success" },
    PENDING_CANCELLATION: { label: "Baixa pendente", tone: "warning" },
    PENDING_ISSUE: { label: "Boleto pendente", tone: "warning" },
    UNKNOWN: { label: "Situação incerta", tone: "warning" },
  };
  return labels[bankSlip.status];
}

export function badgeToneClass(tone: BadgeTone) {
  const classes: Record<BadgeTone, string> = {
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return classes[tone];
}

export function isFullBankSlipRecord(
  bankSlip: BankSlipListRecord | null | undefined,
): bankSlip is BankSlipRecord {
  return Boolean(bankSlip && "linhaDigitavel" in bankSlip);
}

export function bankSlipDisplayNumber(
  bankSlip: BankSlipListRecord | null | undefined,
) {
  if (bankSlip === undefined) {
    return "Carregando";
  }
  if (!bankSlip) {
    return "Indisponível";
  }
  if (isFullBankSlipRecord(bankSlip)) {
    return bankSlip.nossoNumeroMasked ?? maskFinanceNumber(bankSlip.nossoNumero) ?? "Sem número";
  }
  return bankSlip.nossoNumeroMasked ?? "Sem número";
}

export function formatLinhaDigitavelDisplay(value: string) {
  return value.replace(/(\d{5})(?=\d)/g, "$1 ").trim();
}

export function formatOptionalFinanceCents(value?: number | null) {
  return typeof value === "number" ? formatFinanceCurrency(value) : "-";
}

function maskFinanceNumber(value?: string | null) {
  if (!value) {
    return null;
  }
  return `${"*".repeat(Math.max(0, value.length - 3))}${value.slice(-3)}`;
}

function isFailedBankSlipStatus(status: BankSlipStatus) {
  return status === "ISSUE_FAILED" || status === "CANCELLATION_FAILED" || status === "UNKNOWN";
}

function isBatchProcessing(batch: BankSlipIssueBatch) {
  return batch.status === "QUEUED" || batch.status === "PROCESSING";
}
