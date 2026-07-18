import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "../src/lib/formatters/date";

assert.equal(formatDate("2026-08-05"), "05/08/2026");
assert.equal(formatDate("2026-08-05T00:00:00.000Z"), "05/08/2026");
assert.equal(formatDate(new Date("2026-08-05T00:00:00.000Z")), "05/08/2026");
assert.equal(formatDate(null), "—");
assert.equal(formatDate(undefined), "—");
assert.equal(formatDate(""), "—");
assert.equal(formatDate("data-invalida"), "—");

assert.equal(formatDateTime(null), "—");
assert.equal(formatDateTime(undefined), "—");
assert.equal(formatDateTime(""), "—");
assert.equal(formatDateTime("data-invalida"), "—");

console.log("Finance date format OK");
