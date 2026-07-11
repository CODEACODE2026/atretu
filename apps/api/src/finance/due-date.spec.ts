import assert from "node:assert/strict";
import { isInvoiceOverdue, parseInvoiceDueDate } from "./due-date.js";

assert.equal(parseInvoiceDueDate("2026-07-11").toISOString(), "2026-07-11T00:00:00.000Z");

assert.equal(
  isInvoiceOverdue({
    dueDate: parseInvoiceDueDate("2026-07-10"),
    today: parseInvoiceDueDate("2026-07-11"),
  }),
  true,
);
assert.equal(
  isInvoiceOverdue({
    dueDate: parseInvoiceDueDate("2026-07-11"),
    today: parseInvoiceDueDate("2026-07-11"),
  }),
  false,
);
assert.equal(
  isInvoiceOverdue({
    dueDate: parseInvoiceDueDate("2026-07-12"),
    today: parseInvoiceDueDate("2026-07-11"),
  }),
  false,
);

assert.throws(() => parseInvoiceDueDate("11/07/2026"), /YYYY-MM-DD/);
assert.throws(() => parseInvoiceDueDate("2026-02-30"), /valid date/);
