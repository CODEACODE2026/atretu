import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const controller = readFileSync(
  new URL("./official-documents.controller.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./official-documents.service.ts", import.meta.url),
  "utf8",
);
const registry = readFileSync(
  new URL("./official-document.registry.ts", import.meta.url),
  "utf8",
);
const appModule = readFileSync(new URL("../app.module.ts", import.meta.url), "utf8");

for (const fragment of [
  "enum OfficialDocumentType",
  "TERMINATION_LETTER",
  "TERMINATION_TERM",
  "model OfficialDocumentIssue",
  "templateKey",
  "templateVersion",
  "notes",
  "OFFICIAL_DOCUMENT_ISSUED",
  "OFFICIAL_DOCUMENT_REISSUED",
  "OFFICIAL_DOCUMENT_VIEWED",
  "OFFICIAL_DOCUMENT_DOWNLOADED",
]) {
  assert.ok(schema.includes(fragment), `schema must include ${fragment}`);
}

for (const fragment of [
  '@Controller("students/:studentId/official-documents")',
  '@Get()',
  '@Post(":type/issue")',
  '@Post(":issueId/reissue")',
  '@Get(":issueId/file")',
  "@Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)",
]) {
  assert.ok(controller.includes(fragment), `controller must include ${fragment}`);
}

for (const fragment of [
  "DocumentStorageService",
  "OfficialDocumentPdfBuilder",
  "getOfficialDocumentDefinition",
  "listOfficialDocumentDefinitions",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_ISSUED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_REISSUED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_VIEWED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_DOWNLOADED",
  "source.documentType",
  "resolveTerminationTermPayload",
  "resolveInstitutionalRepresentative",
  "Data da notificacao nao pode ser anterior ao vencimento",
  "Representante institucional oficial nao configurado",
  "Presidente da ATRETU",
]) {
  assert.ok(service.includes(fragment), `service must include ${fragment}`);
}

for (const fragment of [
  "OFFICIAL_DOCUMENT_DEFINITIONS",
  "templateKey: \"termination-letter\"",
  "templateKey: \"termination-term\"",
  "templateVersion: 1",
  "StudentStatus.TERMINATED",
  "Termo de Desligamento",
]) {
  assert.ok(registry.includes(fragment), `registry must include ${fragment}`);
}

assert.ok(
  appModule.includes("OfficialDocumentsModule"),
  "AppModule must register official documents",
);

console.log("Official documents infrastructure guard OK");
