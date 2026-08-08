import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync("src/lib/api.ts", "utf8");
const tab = readFileSync("src/app/admin/students/student-documents.tsx", "utf8");
const official = readFileSync(
  "src/app/admin/students/student-official-documents.tsx",
  "utf8",
);
const institutional = readFileSync(
  "src/app/admin/official-documents-panel.tsx",
  "utf8",
);
const navigation = readFileSync("src/app/admin/admin-navigation.ts", "utf8");
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
  "ADHESION_TERM",
  "ANNUAL_CLEARANCE_DECLARATION",
  "TRANSPORT_REGULATION",
  "TRANSPORT_REFUND_REQUEST",
  "adhesionDetails",
  "refundDetails",
  "annualClearanceDetails",
  "totalAmountCents",
  "finalClearanceDate",
  "year",
  "firstInstallmentDate",
  "installmentAmountCents",
  "installmentCount",
  "installmentDueDay",
  "totalContractAmountCents",
  "signerRoleLabel",
  "signerStudentId",
  "resolvedAt",
  "TERMINATION_LETTER",
  "TERMINATION_TERM",
  "INTERNAL_REGULATION",
  "IssueOfficialDocumentBody",
  "refundAmountCents",
  "paymentMethod",
  "IssueInstitutionalOfficialDocumentBody",
  "/official-documents",
  "listInstitutionalOfficialDocuments",
  "issueInstitutionalOfficialDocument",
  "reissueInstitutionalOfficialDocument",
  "downloadInstitutionalOfficialDocument",
]) {
  assert.ok(api.includes(fragment), `api client must include ${fragment}`);
}

assert.ok(
  tab.includes("studentName={studentName}"),
  "Student documents tab must render official documents",
);

for (const fragment of [
  "Documentos Oficiais",
  "official-documents",
]) {
  assert.ok(navigation.includes(fragment), `navigation must include ${fragment}`);
}

for (const fragment of [
  "Institucionais",
  "Regimento",
  "Emitir",
  "Visualizar",
  "Reemitir",
  "Baixar",
  "Histórico",
  "Histórico de versões",
  "Versão vigente",
  "Protocolo da versão",
  "Assinado por",
  "Emitir Regimento Interno",
  "Data de aprovação",
  "Observações",
  "signerPreview",
]) {
  assert.ok(
    institutional.includes(fragment),
    `institutional official documents UI must include ${fragment}`,
  );
}

for (const fragment of [
  "Documentos Oficiais",
  "Emitir",
  "Visualizar",
  "Reemitir",
  "Baixar PDF",
  "Protocolo",
  "Assinado por",
  "Emitir Termo de Desligamento",
  "Emitir Termo de Adesão e Filiação",
  "Emitir Declaração de Quitação Anual",
  "Ano de referência",
  "Valor total quitado",
  "Data da quitação final",
  "Emitir Solicitação de Reembolso",
  "Valor do reembolso",
  "Forma de recebimento",
  "Chave PIX",
  "Conta bancária",
  "Primeira mensalidade",
  "Valor da parcela",
  "Quantidade de parcelas",
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
    `${official}\n${institutional}`.includes(forbidden),
    false,
    `official documents UI must not use ${forbidden}`,
  );
}

console.log("Official documents frontend guard OK");
