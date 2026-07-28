import type {
  CollectionAction,
  CollectionAgingBucket,
  CollectionCase,
  CollectionOperationalStatus,
  CollectionPriority,
} from "../../../../lib/api";

export type CollectionFilters = {
  institutionId: string;
  academicYearId: string;
  search: string;
  dueDateFrom: string;
  dueDateTo: string;
  agingBucket: CollectionAgingBucket | "";
  operationalStatus: CollectionOperationalStatus | "";
  actionType: CollectionAction["actionType"] | "";
  followUpFrom: string;
  followUpTo: string;
};

export const collectionAgingBuckets: CollectionAgingBucket[] = [
  "DAYS_1_30",
  "DAYS_31_60",
  "DAYS_61_90",
  "DAYS_90_PLUS",
];

export const collectionOperationalStatuses: CollectionOperationalStatus[] = [
  "OVERDUE_NO_ACTION",
  "CONTACTED",
  "PROMISE_ACTIVE",
  "PROMISE_BROKEN",
  "FOLLOW_UP_SCHEDULED",
  "NO_CONTACT",
  "PARTIAL_PAYMENT_REVIEW",
];

export const emptyCollectionFilters: CollectionFilters = {
  institutionId: "",
  academicYearId: "",
  search: "",
  dueDateFrom: "",
  dueDateTo: "",
  agingBucket: "",
  operationalStatus: "",
  actionType: "",
  followUpFrom: "",
  followUpTo: "",
};

export function formatCents(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value ?? 0) / 100);
}

export function hasActiveCollectionFilters(filters: CollectionFilters) {
  return Object.values(filters).some((value) => value !== "");
}

export function collectionPriorityTone(value: CollectionPriority) {
  if (value === "CRITICAL") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (value === "HIGH") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function collectionStatusTone(value: CollectionOperationalStatus) {
  const tones: Record<CollectionOperationalStatus, string> = {
    OVERDUE_NO_ACTION: "border-amber-200 bg-amber-50 text-amber-800",
    CONTACTED: "border-cyan-200 bg-cyan-50 text-cyan-800",
    PROMISE_ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
    PROMISE_BROKEN: "border-red-200 bg-red-50 text-red-800",
    FOLLOW_UP_SCHEDULED: "border-blue-200 bg-blue-50 text-blue-800",
    NO_CONTACT: "border-orange-200 bg-orange-50 text-orange-800",
    PARTIAL_PAYMENT_REVIEW: "border-purple-200 bg-purple-50 text-purple-800",
    RESOLVED_BY_PAYMENT: "border-emerald-200 bg-emerald-50 text-emerald-800",
    CANCELLED: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return tones[value];
}

export function formatOutstanding(caseItem: CollectionCase) {
  return (
    caseItem.outstandingAmountFormatted ??
    formatCents(caseItem.outstandingAmountCents)
  );
}

export function bankSlipDisplay(caseItem: CollectionCase) {
  if (!caseItem.bankSlip) {
    return {
      label: "Sem boleto",
      detail: "Nenhum boleto vinculado",
      tone: "text-slate-500",
    };
  }
  return {
    label: caseItem.bankSlip.status,
    detail: caseItem.bankSlip.pdfStoredAt ? "PDF arquivado" : "Sem PDF",
    tone: caseItem.bankSlip.pdfStoredAt ? "text-emerald-700" : "text-amber-700",
  };
}

export function collectionRiskSignals(caseItem: CollectionCase) {
  const signals: string[] = [];
  if (caseItem.brokenPromise) {
    signals.push("Promessa vencida");
  }
  if (caseItem.partialPaymentReview) {
    signals.push("Pagamento parcial em revisao");
  }
  if (caseItem.nextFollowUpAt) {
    signals.push("Retorno agendado");
  }
  return signals;
}
