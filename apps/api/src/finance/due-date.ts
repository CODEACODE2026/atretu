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
  const today = input.today ?? new Date();
  return toUtcDateOnly(input.dueDate).getTime() < toUtcDateOnly(today).getTime();
}

function toUtcDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
