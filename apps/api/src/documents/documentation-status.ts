import { StudentDocumentType } from "@prisma/client";
import { DOCUMENT_TYPES } from "./document-file.js";

export type DocumentationStatus = "none" | "partial" | "complete";

export function deriveDocumentationStatus(
  activeDocumentTypes: readonly StudentDocumentType[],
) {
  const expectedTypes = DOCUMENT_TYPES as readonly StudentDocumentType[];
  const activeExpectedTypes = new Set(
    activeDocumentTypes.filter((type) => expectedTypes.includes(type)),
  );
  const missingTypes = expectedTypes.filter((type) => !activeExpectedTypes.has(type));
  const activeDocumentCount = activeExpectedTypes.size;
  const missingDocumentCount = missingTypes.length;
  const documentationStatus: DocumentationStatus =
    activeDocumentCount === 0
      ? "none"
      : missingDocumentCount > 0
        ? "partial"
        : "complete";

  return {
    expectedDocumentCount: expectedTypes.length,
    activeDocumentCount,
    missingDocumentCount,
    missingTypes,
    documentationStatus,
  };
}
