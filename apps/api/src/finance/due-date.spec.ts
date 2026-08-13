import "reflect-metadata";
import assert from "node:assert/strict";
import {
  compareInvoiceDueDate,
  isInvoiceDueToday,
  isInvoiceOverdue,
  localDateKey,
  parseInvoiceDueDate,
} from "./due-date.js";
import { buildInvoiceOverdueWhere } from "./invoices.service.js";
import { InvoiceOverdueFilter } from "./dto/invoices.dto.js";

assert.equal(parseInvoiceDueDate("2026-07-11").toISOString(), "2026-07-11T00:00:00.000Z");
const julyElevenSaoPaulo = new Date("2026-07-11T12:00:00.000Z");

assert.equal(
  isInvoiceOverdue({
    dueDate: parseInvoiceDueDate("2026-07-10"),
    today: julyElevenSaoPaulo,
  }),
  true,
);
assert.equal(
  isInvoiceOverdue({
    dueDate: parseInvoiceDueDate("2026-07-11"),
    today: julyElevenSaoPaulo,
  }),
  false,
);
assert.equal(
  isInvoiceOverdue({
    dueDate: parseInvoiceDueDate("2026-07-12"),
    today: julyElevenSaoPaulo,
  }),
  false,
);
assert.equal(
  isInvoiceDueToday({
    dueDate: parseInvoiceDueDate("2026-07-11"),
    today: julyElevenSaoPaulo,
  }),
  true,
);
assert.equal(localDateKey(new Date("2026-08-13T01:30:00.000Z")), "2026-08-12");
assert.equal(
  compareInvoiceDueDate(
    parseInvoiceDueDate("2026-08-13"),
    new Date("2026-08-13T01:30:00.000Z"),
  ) > 0,
  true,
);
assert.equal(
  isInvoiceDueToday({
    dueDate: parseInvoiceDueDate("2026-08-13"),
    today: new Date("2026-08-13T01:30:00.000Z"),
  }),
  false,
);
assert.equal(
  isInvoiceOverdue({
    dueDate: parseInvoiceDueDate("2026-08-12"),
    today: new Date("2026-08-13T02:59:00.000Z"),
  }),
  false,
);
assert.equal(
  isInvoiceDueToday({
    dueDate: parseInvoiceDueDate("2026-08-13"),
    today: new Date("2026-08-13T03:01:00.000Z"),
  }),
  true,
);

assert.deepEqual(
  buildInvoiceOverdueWhere(
    InvoiceOverdueFilter.OVERDUE,
    julyElevenSaoPaulo,
  ),
  {
    status: "OPEN",
    dueDate: { lt: parseInvoiceDueDate("2026-07-11") },
  },
);
assert.deepEqual(
  buildInvoiceOverdueWhere(
    InvoiceOverdueFilter.NOT_OVERDUE,
    julyElevenSaoPaulo,
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
