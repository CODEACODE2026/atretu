import assert from "node:assert/strict";
import { StudentDocumentType } from "@prisma/client";
import { deriveDocumentationStatus } from "./documentation-status.js";

const none = deriveDocumentationStatus([]);
assert.equal(none.documentationStatus, "none");
assert.equal(none.activeDocumentCount, 0);
assert.equal(none.missingDocumentCount, 4);

const partial = deriveDocumentationStatus([
  StudentDocumentType.CPF,
  StudentDocumentType.PHOTO,
]);
assert.equal(partial.documentationStatus, "partial");
assert.equal(partial.activeDocumentCount, 1);
assert.equal(partial.missingTypes.includes(StudentDocumentType.RG), true);

const duplicate = deriveDocumentationStatus([
  StudentDocumentType.CPF,
  StudentDocumentType.CPF,
  StudentDocumentType.RG,
]);
assert.equal(duplicate.activeDocumentCount, 2);

const complete = deriveDocumentationStatus([
  StudentDocumentType.CPF,
  StudentDocumentType.RG,
  StudentDocumentType.PROOF_OF_ADDRESS,
  StudentDocumentType.PROOF_OF_ENROLLMENT,
]);
assert.equal(complete.documentationStatus, "complete");
assert.equal(complete.missingDocumentCount, 0);
