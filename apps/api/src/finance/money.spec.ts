import assert from "node:assert/strict";
import {
  assertValidInvoiceAmountCents,
  formatCentsAsSicrediAmount,
  formatInvoiceAmount,
  parseInvoiceAmountToCents,
  parseSicrediAmountToCents,
} from "./money.js";

assert.equal(parseInvoiceAmountToCents("1"), 100);
assert.equal(parseInvoiceAmountToCents("1,50"), 150);
assert.equal(parseInvoiceAmountToCents("1.234,56"), 123456);
assert.equal(parseInvoiceAmountToCents("1234.56"), 123456);
assert.equal(formatInvoiceAmount(123456), "R$ 1.234,56");
assert.equal(formatCentsAsSicrediAmount(123456), "1234.56");
assert.equal(formatCentsAsSicrediAmount(100), "1.00");
assert.equal(parseSicrediAmountToCents("1234.56"), 123456);
assert.equal(parseSicrediAmountToCents("1234,56"), 123456);
assert.equal(parseSicrediAmountToCents(1234.56), 123456);

assert.doesNotThrow(() => assertValidInvoiceAmountCents(1));
assert.throws(() => assertValidInvoiceAmountCents(0), /positive integer/);
assert.throws(() => assertValidInvoiceAmountCents(1.5), /positive integer/);
assert.throws(() => parseInvoiceAmountToCents("abc"), /monetary value/);
assert.throws(() => parseInvoiceAmountToCents("10,999"), /monetary value/);
assert.throws(() => parseSicrediAmountToCents("0.00"), /positive integer/);
assert.throws(() => parseSicrediAmountToCents("10.999"), /decimal value/);
