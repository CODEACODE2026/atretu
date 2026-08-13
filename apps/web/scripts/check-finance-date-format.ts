import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "../src/lib/formatters/date";
import {
  isInvoiceDueTodayForDisplay,
  isInvoiceUpcomingForDisplay,
} from "../src/app/admin/finance/invoice-display-utils";

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

const saoPauloStillAugustTwelve = new Date("2026-08-13T01:30:00.000Z");
assert.equal(
  isInvoiceDueTodayForDisplay(
    { dueDate: "2026-08-13" },
    saoPauloStillAugustTwelve,
  ),
  false,
);
assert.equal(
  isInvoiceUpcomingForDisplay(
    { dueDate: "2026-08-13", overdue: false },
    saoPauloStillAugustTwelve,
  ),
  true,
);
assert.equal(
  isInvoiceDueTodayForDisplay(
    { dueDate: "2026-08-12" },
    saoPauloStillAugustTwelve,
  ),
  true,
);
assert.equal(
  isInvoiceDueTodayForDisplay(
    { dueDate: "2026-08-13" },
    new Date("2026-08-13T03:01:00.000Z"),
  ),
  true,
);

console.log("Finance date format OK");
