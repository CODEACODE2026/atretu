import assert from "node:assert/strict";
import { buildStudentCardNumber } from "./card-number.js";

assert.equal(buildStudentCardNumber(1, 2026), "12026");
assert.equal(buildStudentCardNumber(2, 2026), "22026");
assert.equal(buildStudentCardNumber(25, 2026), "252026");
assert.equal(buildStudentCardNumber(1, 2027), "12027");

assert.throws(() => buildStudentCardNumber(0, 2026), /sequenceNumber/);
assert.throws(() => buildStudentCardNumber(1.5, 2026), /sequenceNumber/);
assert.throws(() => buildStudentCardNumber(1, 1999), /valid academic year/);
