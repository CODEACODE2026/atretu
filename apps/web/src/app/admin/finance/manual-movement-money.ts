export function formatMoneyInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return formatCentsAsCurrency(parseMoneyToCents(trimmed));
  } catch {
    return value;
  }
}

export function parseMoneyToCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Informe um valor maior que zero.");
  }
  const withoutCurrency = trimmed.replace(/^R\$\s*/i, "").replace(/\s/g, "");
  const normalized = withoutCurrency.includes(",")
    ? withoutCurrency.replace(/\./g, "").replace(",", ".")
    : withoutCurrency;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Informe um valor valido, como 25,00.");
  }
  const [reais = "0", cents = ""] = normalized.split(".");
  const amountCents =
    Number.parseInt(reais, 10) * 100 +
    Number.parseInt(cents.padEnd(2, "0") || "0", 10);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  return amountCents;
}

export function centsToInput(value: number) {
  return formatCentsAsCurrency(value);
}

function formatCentsAsCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}
