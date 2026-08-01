import { type InvoiceRecord } from "../../../lib/api";
import {
  isFullBankSlipRecord,
  type BankSlipListRecord,
} from "./finance-display-utils";

export type InvoiceQuickFilter =
  | "all"
  | "open"
  | "overdue"
  | "dueToday"
  | "upcoming"
  | "paid"
  | "cancelled"
  | "withoutSlip"
  | "partialReview";

export type InvoiceOperationalSummary = {
  cancelled: number;
  dueToday: number;
  open: number;
  overdue: number;
  paid: number;
  partialReview: number;
  upcoming: number;
  withoutSlip: number;
};

type PaymentPeriod = {
  paidAtFrom?: string;
  paidAtTo?: string;
};

export function calculateInvoiceOperationalSummary(
  invoices: InvoiceRecord[],
  bankSlips: Record<string, BankSlipListRecord | null | undefined>,
  paymentPeriod: PaymentPeriod = {},
): InvoiceOperationalSummary {
  return invoices.reduce<InvoiceOperationalSummary>(
    (summary, invoice) => {
      const bankSlip = invoiceBankSlip(invoice, bankSlips);
      if (invoice.status === "OPEN") {
        summary.open += 1;
      }
      if (invoice.status === "OPEN" && invoice.overdue) {
        summary.overdue += 1;
      }
      if (invoice.status === "OPEN" && isDueToday(invoice)) {
        summary.dueToday += 1;
      }
      if (invoice.status === "OPEN" && isUpcoming(invoice)) {
        summary.upcoming += 1;
      }
      if (isPaidInPeriod(invoice, bankSlip, paymentPeriod)) {
        summary.paid += 1;
      }
      if (invoice.status === "CANCELLED") {
        summary.cancelled += 1;
      }
      if (invoice.status === "OPEN" && !bankSlip) {
        summary.withoutSlip += 1;
      }
      if (isPartialOrReview(invoice, bankSlip)) {
        summary.partialReview += 1;
      }
      return summary;
    },
    {
      cancelled: 0,
      dueToday: 0,
      open: 0,
      overdue: 0,
      paid: 0,
      partialReview: 0,
      upcoming: 0,
      withoutSlip: 0,
    },
  );
}

export function filterInvoicesByQuickFilter(
  invoices: InvoiceRecord[],
  bankSlips: Record<string, BankSlipListRecord | null | undefined>,
  quickFilter: InvoiceQuickFilter,
  paymentPeriod: PaymentPeriod = {},
) {
  if (quickFilter === "all") {
    return invoices;
  }
  return invoices.filter((invoice) => {
    const bankSlip = invoiceBankSlip(invoice, bankSlips);
    if (quickFilter === "open") {
      return invoice.status === "OPEN";
    }
    if (quickFilter === "overdue") {
      return invoice.status === "OPEN" && invoice.overdue;
    }
    if (quickFilter === "dueToday") {
      return invoice.status === "OPEN" && isDueToday(invoice);
    }
    if (quickFilter === "upcoming") {
      return invoice.status === "OPEN" && isUpcoming(invoice);
    }
    if (quickFilter === "paid") {
      return isPaidInPeriod(invoice, bankSlip, paymentPeriod);
    }
    if (quickFilter === "cancelled") {
      return invoice.status === "CANCELLED";
    }
    if (quickFilter === "withoutSlip") {
      return invoice.status === "OPEN" && !bankSlip;
    }
    return isPartialOrReview(invoice, bankSlip);
  });
}

export function sortInvoicesOperationally(
  invoices: InvoiceRecord[],
  bankSlips: Record<string, BankSlipListRecord | null | undefined>,
) {
  return [...invoices].sort((left, right) => {
    const leftRank = invoiceOperationalRank(left, invoiceBankSlip(left, bankSlips));
    const rightRank = invoiceOperationalRank(right, invoiceBankSlip(right, bankSlips));
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftDue = new Date(left.dueDate).getTime();
    const rightDue = new Date(right.dueDate).getTime();
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }
    return left.id.localeCompare(right.id);
  });
}

export function invoiceOperationalTone(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  if (invoice.status === "PAID") {
    return "success";
  }
  if (invoice.status === "CANCELLED") {
    return "neutral";
  }
  if (isPartialOrReview(invoice, bankSlip)) {
    return "warning";
  }
  if (invoice.overdue) {
    return "danger";
  }
  if (isDueToday(invoice)) {
    return "warning";
  }
  if (!bankSlip) {
    return "info";
  }
  return "neutral";
}

export function invoiceOperationalLabel(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  if (invoice.status === "PAID") {
    return "Resolvida";
  }
  if (invoice.status === "CANCELLED") {
    return "Cancelada";
  }
  if (isPartialOrReview(invoice, bankSlip)) {
    return "Baixa em revisão";
  }
  if (invoice.overdue) {
    return "Exige ação";
  }
  if (isDueToday(invoice)) {
    return "Vence hoje";
  }
  if (!bankSlip) {
    return "Sem boleto";
  }
  return "Aberta";
}

export function quickFilterLabel(filter: InvoiceQuickFilter) {
  const labels: Record<InvoiceQuickFilter, string> = {
    all: "Todas",
    cancelled: "Canceladas",
    dueToday: "Vencem hoje",
    open: "Abertas",
    overdue: "Vencidas",
    paid: "Pagos no mês",
    partialReview: "Pagamento parcial/revisão",
    upcoming: "Próximos vencimentos",
    withoutSlip: "Sem boleto",
  };
  return labels[filter];
}

function invoiceOperationalRank(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  if (invoice.status === "OPEN" && invoice.overdue) {
    return 1;
  }
  if (invoice.status === "OPEN" && isDueToday(invoice)) {
    return 2;
  }
  if (invoice.status === "OPEN" && isUpcoming(invoice)) {
    return 3;
  }
  if (invoice.status === "OPEN" && !bankSlip) {
    return 4;
  }
  if (isPartialOrReview(invoice, bankSlip)) {
    return 5;
  }
  if (invoice.status === "OPEN") {
    return 6;
  }
  if (invoice.status === "PAID") {
    return 7;
  }
  return 8;
}

function invoiceBankSlip(
  invoice: InvoiceRecord,
  bankSlips: Record<string, BankSlipListRecord | null | undefined>,
) {
  return bankSlips[invoice.id] ?? invoice.bankSlipSummary;
}

function isPaidInPeriod(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
  paymentPeriod: PaymentPeriod,
) {
  if (invoice.status !== "PAID" || bankSlip?.status !== "PAID" || !bankSlip.paidAt) {
    return false;
  }
  const paidAt = dateKey(bankSlip.paidAt);
  return (
    (!paymentPeriod.paidAtFrom || paidAt >= paymentPeriod.paidAtFrom) &&
    (!paymentPeriod.paidAtTo || paidAt <= paymentPeriod.paidAtTo)
  );
}

function isDueToday(invoice: InvoiceRecord) {
  return dateKey(invoice.dueDate) === dateKey(new Date().toISOString());
}

function isUpcoming(invoice: InvoiceRecord) {
  if (invoice.overdue || isDueToday(invoice)) {
    return false;
  }
  return new Date(invoice.dueDate).getTime() > startOfToday().getTime();
}

function isPartialOrReview(
  invoice: InvoiceRecord,
  bankSlip: BankSlipListRecord | null | undefined,
) {
  if (!bankSlip || !isFullBankSlipRecord(bankSlip)) {
    return false;
  }
  const paid = bankSlip.paidAmountCents ?? 0;
  return (
    bankSlip.providerErrorCode === "PARTIAL_PAYMENT_REVIEW" ||
    (paid > 0 && paid < invoice.amountCents)
  );
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
