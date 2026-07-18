export function formatDate(value?: string | Date | null) {
  const date = parseDateValue(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

export function formatDateTime(value?: string | Date | null) {
  const date = parseDateValue(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function parseDateValue(value?: string | Date | null) {
  if (!value) {
    return null;
  }
  const date =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00.000Z`)
        : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
