import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync("src/lib/api.ts", "utf8");
const tab = readFileSync("src/app/admin/students/student-documents.tsx", "utf8");
const official = readFileSync(
  "src/app/admin/students/student-official-documents.tsx",
  "utf8",
);
const profileSummary = readFileSync(
  "src/app/admin/students/student-profile-summary.tsx",
  "utf8",
);
const actionDialogs = readFileSync(
  "src/app/admin/students/student-action-dialogs.tsx",
  "utf8",
);

for (const fragment of [
  "export type OfficialDocumentType",
  "OfficialDocumentCatalogItem",
  "templateKey",
  "templateVersion",
  "listStudentOfficialDocuments",
  "issueOfficialDocument",
  "reissueOfficialDocument",
  "downloadOfficialDocument",
  "formatApiErrorBody",
  "requestId",
  "signerDetails",
  "signerRoleLabel",
  "signerStudentId",
  "resolvedAt",
  "TERMINATION_LETTER",
  "TERMINATION_TERM",
  "IssueOfficialDocumentBody",
  "/official-documents",
]) {
  assert.ok(api.includes(fragment), `api client must include ${fragment}`);
}

assert.ok(
  tab.includes("studentName={studentName}"),
  "Student documents tab must render official documents",
);

for (const fragment of [
  "Documentos Oficiais",
  "Emitir",
  "Visualizar",
  "Reemitir",
  "Baixar PDF",
  "Protocolo",
  "Assinado por",
  "Emitir Termo de Desligamento",
  "Data do vencimento",
  "Data da notificacao",
  "Inadimplência",
]) {
  assert.ok(official.includes(fragment), `official documents UI must include ${fragment}`);
}

for (const fragment of [
  "Signatário de documentos: Presidente",
  "Alterar cargo da diretoria",
  "updateBoardMembershipRole",
]) {
  assert.ok(
    `${profileSummary}\n${actionDialogs}`.includes(fragment),
    `board signers UI must include ${fragment}`,
  );
}

for (const forbidden of ["window.confirm", "window.prompt", "window.alert"]) {
  assert.equal(
    official.includes(forbidden),
    false,
    `official documents UI must not use ${forbidden}`,
  );
}

console.log("Official documents frontend guard OK");
