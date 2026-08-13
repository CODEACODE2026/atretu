const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";

export function parseInvoiceDueDate(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error("dueDate must use YYYY-MM-DD");
  }
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new Error("dueDate must be a valid date");
  }
  return date;
}

export function isInvoiceOverdue(input: { dueDate: Date; today?: Date }) {
  return compareInvoiceDueDate(input.dueDate, input.today ?? new Date()) < 0;
}

export function isInvoiceDueToday(input: { dueDate: Date; today?: Date }) {
  return compareInvoiceDueDate(input.dueDate, input.today ?? new Date()) === 0;
}

export function compareInvoiceDueDate(dueDate: Date, today: Date) {
  return invoiceDateKey(dueDate).localeCompare(localDateKey(today));
}

export function invoiceDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function localDateKey(value: Date, timeZone = OPERATIONAL_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function toUtcDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
