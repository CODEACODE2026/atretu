import "reflect-metadata";
import assert from "node:assert/strict";
import { isInvoiceOverdue, parseInvoiceDueDate } from "./due-date.js";
import { buildInvoiceOverdueWhere } from "./invoices.service.js";
import { InvoiceOverdueFilter } from "./dto/invoices.dto.js";

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

assert.deepEqual(
  buildInvoiceOverdueWhere(
    InvoiceOverdueFilter.OVERDUE,
    parseInvoiceDueDate("2026-07-11"),
  ),
  {
    status: "OPEN",
    dueDate: { lt: parseInvoiceDueDate("2026-07-11") },
  },
);
assert.deepEqual(
  buildInvoiceOverdueWhere(
    InvoiceOverdueFilter.NOT_OVERDUE,
    parseInvoiceDueDate("2026-07-11"),
  ),
  {
    NOT: {
      status: "OPEN",
      dueDate: { lt: parseInvoiceDueDate("2026-07-11") },
    },
  },
);
assert.equal(buildInvoiceOverdueWhere(InvoiceOverdueFilter.ALL), null);

assert.throws(() => parseInvoiceDueDate("11/07/2026"), /YYYY-MM-DD/);
assert.throws(() => parseInvoiceDueDate("2026-02-30"), /valid date/);
