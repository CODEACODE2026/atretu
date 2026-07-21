import type {
  CollectionActionType,
  CollectionAgingBucket,
  CollectionChannel,
  CollectionOperationalStatus,
  CollectionPriority,
} from "../../lib/api";

export const collectionActionTypes: CollectionActionType[] = [
  "CONTACT_ATTEMPT",
  "CONTACT_MADE",
  "PROMISE_TO_PAY",
  "FOLLOW_UP_SCHEDULED",
  "NO_CONTACT",
  "PARTIAL_PAYMENT_REVIEW_NOTE",
  "INTERNAL_NOTE",
];

export const collectionChannels: CollectionChannel[] = [
  "PHONE",
  "WHATSAPP",
  "EMAIL",
  "IN_PERSON",
  "OTHER",
];

export function collectionAgingBucketLabel(value: CollectionAgingBucket) {
  const labels: Record<CollectionAgingBucket, string> = {
    DAYS_1_30: "1 a 30 dias",
    DAYS_31_60: "31 a 60 dias",
    DAYS_61_90: "61 a 90 dias",
    DAYS_90_PLUS: "91 dias ou mais",
  };
  return labels[value];
}

export function collectionOperationalStatusLabel(
  value: CollectionOperationalStatus,
) {
  const labels: Record<CollectionOperationalStatus, string> = {
    OVERDUE_NO_ACTION: "Sem acao registrada",
    CONTACTED: "Contato realizado",
    PROMISE_ACTIVE: "Promessa ativa",
    PROMISE_BROKEN: "Promessa quebrada",
    FOLLOW_UP_SCHEDULED: "Retorno agendado",
    NO_CONTACT: "Sem contato",
    PARTIAL_PAYMENT_REVIEW: "Pagamento parcial em revisao",
    RESOLVED_BY_PAYMENT: "Resolvida por pagamento",
    CANCELLED: "Cancelada",
  };
  return labels[value];
}

export function collectionPriorityLabel(value: CollectionPriority) {
  const labels: Record<CollectionPriority, string> = {
    NORMAL: "Normal",
    HIGH: "Alta",
    CRITICAL: "Critica",
  };
  return labels[value];
}

export function collectionActionTypeLabel(value: CollectionActionType) {
  const labels: Record<CollectionActionType, string> = {
    CONTACT_ATTEMPT: "Tentativa de contato",
    CONTACT_MADE: "Contato realizado",
    PROMISE_TO_PAY: "Promessa de pagamento",
    FOLLOW_UP_SCHEDULED: "Retorno agendado",
    NO_CONTACT: "Sem contato",
    PARTIAL_PAYMENT_REVIEW_NOTE: "Nota de pagamento parcial",
    INTERNAL_NOTE: "Observacao interna",
  };
  return labels[value];
}

export function collectionChannelLabel(value?: CollectionChannel | null) {
  if (!value) {
    return "Nao informado";
  }
  const labels: Record<CollectionChannel, string> = {
    PHONE: "Telefone",
    WHATSAPP: "WhatsApp",
    EMAIL: "E-mail",
    IN_PERSON: "Presencial",
    OTHER: "Outro",
  };
  return labels[value];
}

export function collectionPriorityClass(value: CollectionPriority) {
  if (value === "CRITICAL") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (value === "HIGH") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}
