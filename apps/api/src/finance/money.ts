export const MAX_INVOICE_AMOUNT_CENTS = 999_999_999;

export function parseInvoiceAmountToCents(input: string) {
  const trimmed = input.trim();
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("amount must be a positive monetary value");
  }

  const [reais = "0", cents = ""] = normalized.split(".");
  const amountCents =
    Number.parseInt(reais, 10) * 100 +
    Number.parseInt(cents.padEnd(2, "0") || "0", 10);

  assertValidInvoiceAmountCents(amountCents);
  return amountCents;
}

export function assertValidInvoiceAmountCents(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer");
  }
  if (amountCents > MAX_INVOICE_AMOUNT_CENTS) {
    throw new Error("amountCents exceeds the technical limit");
  }
}

export function formatInvoiceAmount(amountCents: number) {
  assertValidInvoiceAmountCents(amountCents);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}
