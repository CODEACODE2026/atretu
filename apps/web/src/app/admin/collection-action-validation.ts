import type {
  CollectionActionType,
  CollectionChannel,
  CreateCollectionActionBody,
} from "../../lib/api";

export type CollectionActionFormState = {
  actionType: CollectionActionType | "";
  channel: CollectionChannel | "";
  contactedName: string;
  contactedDocumentMasked: string;
  note: string;
  promisedAmountReais: string;
  promiseDueDate: string;
  nextFollowUpAt: string;
};

export type CollectionActionValidationResult =
  | { ok: true; body: CreateCollectionActionBody }
  | { ok: false; errors: Partial<Record<keyof CollectionActionFormState, string>> };

const contactActionTypes: CollectionActionType[] = [
  "CONTACT_ATTEMPT",
  "CONTACT_MADE",
  "NO_CONTACT",
];

export const emptyCollectionActionForm: CollectionActionFormState = {
  actionType: "",
  channel: "",
  contactedName: "",
  contactedDocumentMasked: "",
  note: "",
  promisedAmountReais: "",
  promiseDueDate: "",
  nextFollowUpAt: "",
};

export function validateCollectionActionForm(
  form: CollectionActionFormState,
): CollectionActionValidationResult {
  const errors: Partial<Record<keyof CollectionActionFormState, string>> = {};
  const actionType = form.actionType || undefined;
  const note = form.note.trim();
  const contactedName = form.contactedName.trim();
  const contactedDocumentMasked = form.contactedDocumentMasked.trim();
  const promiseDueDate = form.promiseDueDate.trim();
  const nextFollowUpAt = form.nextFollowUpAt.trim();
  let promisedAmountCents: number | undefined;

  if (!actionType) {
    errors.actionType = "Selecione o tipo da acao";
  }
  if (!note) {
    errors.note = "Informe a observacao";
  } else if (note.length > 1000) {
    errors.note = "A observacao deve ter no maximo 1000 caracteres";
  }
  if (actionType && contactActionTypes.includes(actionType) && !form.channel) {
    errors.channel = "Informe o canal";
  }
  if (actionType === "PROMISE_TO_PAY" && !isDateOnly(promiseDueDate)) {
    errors.promiseDueDate = "Informe uma data de promessa valida";
  }
  if (actionType === "FOLLOW_UP_SCHEDULED" && !isDateTimeLocal(nextFollowUpAt)) {
    errors.nextFollowUpAt = "Informe data e hora do retorno";
  }
  if (nextFollowUpAt && !isDateTimeLocal(nextFollowUpAt)) {
    errors.nextFollowUpAt = "Informe data e hora validas";
  }
  if (promiseDueDate && !isDateOnly(promiseDueDate)) {
    errors.promiseDueDate = "Informe uma data valida";
  }
  if (contactedDocumentMasked && looksLikeFullDocument(contactedDocumentMasked)) {
    errors.contactedDocumentMasked = "Informe apenas documento mascarado";
  }
  if (form.promisedAmountReais.trim()) {
    const parsed = parseMoneyToCents(form.promisedAmountReais);
    if (parsed === null) {
      errors.promisedAmountReais = "Informe um valor positivo em reais";
    } else {
      promisedAmountCents = parsed;
    }
  }

  if (Object.keys(errors).length > 0 || !actionType) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    body: {
      actionType,
      ...(form.channel ? { channel: form.channel } : {}),
      ...(contactedName ? { contactedName } : {}),
      ...(contactedDocumentMasked ? { contactedDocumentMasked } : {}),
      note,
      ...(promisedAmountCents ? { promisedAmountCents } : {}),
      ...(promiseDueDate ? { promiseDueDate } : {}),
      ...(nextFollowUpAt ? { nextFollowUpAt: toIsoDateTime(nextFollowUpAt) } : {}),
    },
  };
}

export function parseMoneyToCents(input: string) {
  const trimmed = input.trim().replace(/^R\$\s?/, "").replace(/\s/g, "");
  if (!trimmed || trimmed.startsWith("-")) {
    return null;
  }
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const [reais = "0", cents = ""] = normalized.split(".");
  const amountCents =
    Number.parseInt(reais, 10) * 100 +
    Number.parseInt(cents.padEnd(2, "0") || "0", 10);
  return Number.isInteger(amountCents) && amountCents > 0
    ? amountCents
    : null;
}

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isDateTimeLocal(value: string) {
  if (!value) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

function looksLikeFullDocument(value: string) {
  const digits = value.replace(/\D/g, "");
  return (digits.length === 11 || digits.length === 14) && !value.includes("*");
}
