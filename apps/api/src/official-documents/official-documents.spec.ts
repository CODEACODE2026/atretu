import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import {
  BoardMemberRole,
  OfficialDocumentDynamicSignatureMode,
  OfficialDocumentType,
} from "@prisma/client";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  OfficialDocumentPdfBuilder,
  type OfficialDocumentPdfBlock,
  type OfficialDocumentPdfInput,
} from "./official-document-pdf.builder.js";
import { OfficialDocumentsService } from "./official-documents.service.js";
import { getOfficialDocumentDefinition } from "./official-document.registry.js";
import {
  extractOfficialDocumentTemplateTokens,
  invalidOfficialDocumentTemplateTokens,
} from "./official-document-template-variables.js";
import {
  ANNUAL_CLEARANCE_DECLARATION_DOCUMENT_TITLE,
  annualClearanceDeclarationBody,
} from "./annual-clearance-declaration.content.js";
import {
  ADHESION_TERM_DOCUMENT_TITLE,
  adhesionTermBody,
} from "./adhesion-term.content.js";
import {
  INTERNAL_REGULATION_DOCUMENT_TITLE,
  internalRegulationBody,
} from "./internal-regulation.content.js";
import {
  TRANSPORT_REGULATION_DOCUMENT_TITLE,
  transportRegulationBody,
} from "./transport-regulation.content.js";
import {
  TRANSPORT_REFUND_REQUEST_DOCUMENT_TITLE,
  transportRefundRequestBody,
} from "./transport-refund-request.content.js";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const controller = readFileSync(
  new URL("./official-documents.controller.ts", import.meta.url),
  "utf8",
);
const dto = readFileSync(
  new URL("./dto/official-documents.dto.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./official-documents.service.ts", import.meta.url),
  "utf8",
);
const studentsController = readFileSync(
  new URL("../students/students.controller.ts", import.meta.url),
  "utf8",
);
const studentsService = readFileSync(
  new URL("../students/students.service.ts", import.meta.url),
  "utf8",
);
const registry = readFileSync(
  new URL("./official-document.registry.ts", import.meta.url),
  "utf8",
);
const internalRegulation = readFileSync(
  new URL("./internal-regulation.content.ts", import.meta.url),
  "utf8",
);
const adhesionTerm = readFileSync(
  new URL("./adhesion-term.content.ts", import.meta.url),
  "utf8",
);
const annualClearanceDeclaration = readFileSync(
  new URL("./annual-clearance-declaration.content.ts", import.meta.url),
  "utf8",
);
const transportRegulation = readFileSync(
  new URL("./transport-regulation.content.ts", import.meta.url),
  "utf8",
);
const transportRefundRequest = readFileSync(
  new URL("./transport-refund-request.content.ts", import.meta.url),
  "utf8",
);
const appModule = readFileSync(new URL("../app.module.ts", import.meta.url), "utf8");

for (const fragment of [
  "enum OfficialDocumentType",
  "TERMINATION_LETTER",
  "ADHESION_TERM",
  "ANNUAL_CLEARANCE_DECLARATION",
  "TRANSPORT_REGULATION",
  "TRANSPORT_REFUND_REQUEST",
  "TERMINATION_TERM",
  "INTERNAL_REGULATION",
  "DYNAMIC_TEMPLATE",
  "enum OfficialDocumentModelStatus",
  "enum OfficialDocumentDynamicSignatureMode",
  "INVALIDATED",
  "invalidatedByUserId",
  "invalidationReason",
  "invalidatedAt",
  "model OfficialDocumentModel",
  "model OfficialDocumentModelVersion",
  "signatureMode",
  "documentModelId",
  "documentModelVersionId",
  "model OfficialDocumentIssue",
  "studentId       String?",
  "templateKey",
  "templateVersion",
  "notes",
  "role            BoardMemberRole?",
  "OFFICIAL_DOCUMENT_ISSUED",
  "OFFICIAL_DOCUMENT_REISSUED",
  "OFFICIAL_DOCUMENT_INVALIDATED",
  "OFFICIAL_DOCUMENT_VIEWED",
  "OFFICIAL_DOCUMENT_DOWNLOADED",
]) {
  assert.ok(schema.includes(fragment), `schema must include ${fragment}`);
}

for (const fragment of [
  '@Controller("students/:studentId/official-documents")',
  '@Controller("official-documents/issues")',
  '@Controller("official-documents/models")',
  '@Controller("official-documents/institutional")',
  "CreateOfficialDocumentModelDto",
  "IssueDynamicOfficialDocumentDto",
  '@Post("models/:modelId/issue")',
  '@Post("models/:modelId/preview")',
  "IssueInstitutionalOfficialDocumentDto",
  '@Get()',
  '@Post(":type/issue")',
  '@Post(":issueId/reissue")',
  '@Post(":issueId/invalidate")',
  '@Get(":issueId/file")',
  "@Roles(...OPERATIONAL_ADMIN_ROLES)",
]) {
  assert.ok(controller.includes(fragment), `controller must include ${fragment}`);
}

for (const fragment of [
  "OfficialDocumentDynamicSignatureMode",
  "OfficialDocumentIssueStatus",
  "@IsEnum(OfficialDocumentDynamicSignatureMode)",
  "InvalidateOfficialDocumentDto",
  "signatureMode?: OfficialDocumentDynamicSignatureMode",
]) {
  assert.ok(dto.includes(fragment), `dto must include ${fragment}`);
}

assert.deepEqual(
  extractOfficialDocumentTemplateTokens(
    "Declaro que {{student.name}}, CPF {{ student.cpf }}, está matriculado em {{institution.name}}.",
  ),
  ["institution.name", "student.cpf", "student.name"],
);
assert.deepEqual(invalidOfficialDocumentTemplateTokens("{{student.foo}}"), [
  "student.foo",
]);

for (const fragment of [
  "createModel",
  "updateModel",
  "current.currentVersion + 1",
  "documentModelId: model.id",
  "documentModelVersionId: version.id",
  "contentSnapshot: snapshot",
  "dynamicTemplate",
  "dynamicSignatureMode",
  "resolveDynamicSigners",
  "signaturePreview",
  "listIssues",
  "normalizeIssueStatusFilter",
  "invalidateStudentIssue",
  "OfficialDocumentIssueStatus.INVALIDATED",
  "resolveDynamicTemplate",
  "OFFICIAL_DOCUMENT_MODEL_CREATED",
  "OFFICIAL_DOCUMENT_MODEL_VERSION_CREATED",
  "OFFICIAL_DOCUMENT_MODEL_ACTIVATED",
  "OFFICIAL_DOCUMENT_MODEL_INACTIVATED",
]) {
  assert.ok(service.includes(fragment), `service must include dynamic model support ${fragment}`);
}

for (const fragment of [
  '@Patch("students/:id/board-memberships/:membershipId/role")',
  "@Roles(RoleCode.SUPER_ADMIN)",
  "updateBoardMembershipRole",
]) {
  assert.ok(studentsController.includes(fragment), `students controller must include ${fragment}`);
}

for (const fragment of [
  "DocumentStorageService",
  "OfficialDocumentPdfBuilder",
  "AssociationSettingsService",
  "getOfficialDocumentDefinition",
  "listOfficialDocumentDefinitions",
  "listInstitutionalOfficialDocuments",
  "signerPreview",
  "issueInstitutionalDocument",
  "reissueInstitutionalDocument",
  "buildInstitutionalSnapshot",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_ISSUED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_REISSUED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_VIEWED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_DOWNLOADED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_INVALIDATED",
  "StudentHistoryEventType.OFFICIAL_DOCUMENT_ISSUED",
  "StudentHistoryEventType.OFFICIAL_DOCUMENT_INVALIDATED",
  "source.documentType",
  "resolveTerminationTermPayload",
  "resolveAdhesionTermPayload",
  "buildAdhesionTermSnapshot",
  "buildAnnualClearanceDeclarationSnapshot",
  "buildTransportRegulationSnapshot",
  "buildTransportRefundRequestSnapshot",
  "transportRegulationBody",
  "transportRefundRequestBody",
  "annualClearanceDeclarationBody",
  "resolveTransportRefundRequestPayload",
  "resolveAnnualClearanceDeclarationPayload",
  "resolveSigners",
  "resolveBoardRoleSigner",
  "status: BoardMembershipStatus.ACTIVE",
  "role: { not: null }",
  "startedAt: { lte: issuedAt }",
  "endedAt: { gte: issuedAt }",
  "signerRoleLabel",
  "signerStudentId",
  "resolvedAt",
  "approvalDate",
  "issueDate",
  "issuePlaceDateText",
  "formatLongDateInSaoPaulo",
  "emittedByUserId",
  "Data da notificacao nao pode ser anterior ao vencimento",
  "Nao existe uma diretoria vigente para a data de emissao",
  "A diretoria vigente nao possui",
  "Ha mais de um",
]) {
  assert.ok(service.includes(fragment), `service must include ${fragment}`);
}

for (const fragment of [
  "Apenas SUPER_ADMIN pode definir cargo institucional da diretoria",
  "assertBoardRoleCanBeAssigned",
  "Ja existe",
]) {
  assert.ok(studentsService.includes(fragment), `students service must include ${fragment}`);
}

for (const fragment of [
  "OFFICIAL_DOCUMENT_DEFINITIONS",
  "templateKey: \"termination-letter\"",
  "templateKey: \"adhesion-term\"",
  "templateKey: \"annual-clearance-declaration\"",
  "templateKey: \"transport-regulation\"",
  "templateKey: \"transport-refund-request\"",
  "templateKey: \"termination-term\"",
  "templateKey: \"internal-regulation\"",
  "templateVersion: 1",
  "StudentStatus.TERMINATED",
  "scope: \"INSTITUTIONAL\"",
  "source: \"STUDENT\"",
  "source: \"BOARD_ROLE\"",
  "source: \"GUARDIAN\"",
  "BoardMemberRole.PRESIDENT",
  "Presidente da ATRETU",
  "Termo de Adesão",
  "Declaração de Quitação Anual",
  "Regimento do Transporte",
  "Solicitação de Reembolso",
  "Termo de Desligamento",
  "Regimento Interno",
]) {
  assert.ok(registry.includes(fragment), `registry must include ${fragment}`);
}

for (const fragment of [
  "adhesionTermBody",
  "Termo de Adesão e Filiação Instrumento Particular de Associação",
  "Cláusula 1ª",
  "Cláusula 6ª",
  "installmentAmount",
  "installmentCountWords",
  "installmentDueDay",
  "sequente",
  "suscetivelmente",
]) {
  assert.ok(adhesionTerm.includes(fragment), `adhesion term must include ${fragment}`);
}
for (const fragment of ["10 parcelas", "R$330,00", "vencimento todo dia 20"]) {
  assert.ok(!adhesionTerm.includes(fragment), `adhesion term must not include ${fragment}`);
}

for (const fragment of [
  "annualClearanceDeclarationBody",
  "Declaração de Quitação Anual",
  "finalClearanceDate",
  "periodStart",
  "periodEnd",
  "totalAmount",
  "totalAmountWords",
  "issuePlaceDateText",
]) {
  assert.ok(
    annualClearanceDeclaration.includes(fragment),
    `annual clearance content must include ${fragment}`,
  );
}
for (const forbidden of ["20/12", "R$ 300,00", "trezentos reais"]) {
  assert.ok(
    !annualClearanceDeclaration.includes(forbidden),
    `annual clearance content must not include fixed legacy fragment ${forbidden}`,
  );
}

for (const fragment of [
  "transportRegulationBody",
  "issuePlaceDateText",
  "DIRETRIZES PARA TRANSPORTE DE ALUNOS",
  "AEUA",
  "R$ 150,00",
  "Unifatecie, Unespar, Unipar, Unopar, IFPR",
  "Artigos 42º",
  "artigos 9º e 10º",
  "TERMO DE CIENCIA DO REGIMENTO DO TRANSPORTE",
  "QUANDO INTERESSADO FOR MENOR DE IDADE",
  "signatureGroup",
]) {
  assert.ok(
    transportRegulation.includes(fragment),
    `transport regulation content must include ${fragment}`,
  );
}

for (const fragment of [
  "transportRefundRequestBody",
  "Solicitação de Reembolso Transporte Universitário",
  "refundAmount",
  "refundAmountWords",
  "reason",
  "methodText",
  "pixKey",
  "bankName",
  "agency",
  "account",
  "issuePlaceDateText",
]) {
  assert.ok(
    transportRefundRequest.includes(fragment),
    `transport refund request content must include ${fragment}`,
  );
}
for (const fragment of ["R$ 200,00", "duzentos reais", "Aleixo Tur", "Terra Ria"]) {
  assert.ok(
    !transportRefundRequest.includes(fragment),
    `transport refund request content must not include fixed legacy fragment ${fragment}`,
  );
}

for (const fragment of [
  "internalRegulationBody",
  "INTERNAL_REGULATION_APPROVAL_DATE",
  "REGIMENTO INTERNO DA ASSOCIAÇÃO TERRARIQUENSE",
  "A diretoria da ATRETU",
  "Regula o presente Capítulo o objeto social da ASSEFAR.",
  "§1º",
  "Art. 33º",
  "Art. 43º",
  "Terra Rica, 20 de dezembro de 2022.",
]) {
  assert.ok(
    internalRegulation.includes(fragment),
    `internal regulation content must include ${fragment}`,
  );
}

assert.ok(
  appModule.includes("OfficialDocumentsModule"),
  "AppModule must register official documents",
);

const pdfBuilder = new OfficialDocumentPdfBuilder();

function makeService(validMembers: unknown[]) {
  return new OfficialDocumentsService(
    { boardMembership: { findMany: async () => validMembers } } as never,
    {} as never,
    {} as never,
    {} as never,
    {
      legacySnapshot: () => ({
        city: "Terra Rica",
        cnpj: "49.682.667/0001-00",
        complement: null,
        displayName: "ATRETU",
        district: "Centro",
        email: "atretu2022@gmail.com",
        footerText:
          "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00",
        issuePlace: "Terra Rica",
        issuePlaceWithState: "Terra Rica - PR",
        legalName:
          "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS",
        logoContentType: "image/png",
        logoFileName: "atretu-logo.png",
        logoSizeBytes: null,
        logoStorageKey: null,
        number: "1276",
        postalCode: "87890-000",
        primaryPhone: "44 99941-3565",
        secondaryPhone: "44 99144-1176",
        state: "PR",
        street: "Av. Claudio Domingos Soletti",
        website: null,
      }),
      readLogoForSnapshot: async () => null,
    } as never,
  ) as never as {
    addMonthsClamped: (value: Date, monthsToAdd: number) => Date;
    listIssues: (query: Record<string, unknown>) => Promise<unknown>;
    reissueSnapshot: (...args: unknown[]) => unknown;
    resolveSigners: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  };
}

function makeListIssuesService() {
  const calls: Array<{ method: string; where: unknown }> = [];
  const prisma = {
    officialDocumentIssue: {
      count: async (args: { where: unknown }) => {
        calls.push({ method: "count", where: args.where });
        return 0;
      },
      findMany: async (args: { where: unknown }) => {
        calls.push({ method: "findMany", where: args.where });
        return [];
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  };
  return {
    calls,
    service: new OfficialDocumentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ) as never as {
      listIssues: (query: Record<string, unknown>) => Promise<unknown>;
    },
  };
}

{
  const { calls, service: listIssuesService } = makeListIssuesService();
  await listIssuesService.listIssues({ limit: 20, page: 1, status: "all" });
  assert.deepEqual(calls.map((call) => call.where), [{}, {}]);
}

{
  const { calls, service: listIssuesService } = makeListIssuesService();
  await listIssuesService.listIssues({ limit: 20, page: 1, status: "ISSUED" });
  assert.deepEqual(calls.map((call) => call.where), [
    { status: "ISSUED" },
    { status: "ISSUED" },
  ]);
}

{
  const { calls, service: listIssuesService } = makeListIssuesService();
  await listIssuesService.listIssues({
    limit: 20,
    page: 1,
    status: "INVALIDATED",
  });
  assert.deepEqual(calls.map((call) => call.where), [
    { status: "INVALIDATED" },
    { status: "INVALIDATED" },
  ]);
}

{
  const { calls, service: listIssuesService } = makeListIssuesService();
  await listIssuesService.listIssues({ limit: 20, page: 1 });
  assert.deepEqual(calls.map((call) => call.where), [{}, {}]);
}

{
  const { service: listIssuesService } = makeListIssuesService();
  await assert.rejects(
    () => listIssuesService.listIssues({ limit: 20, page: 1, status: "foo" }),
    BadRequestException,
  );
}

const signerStudent = {
  id: "student-1",
  guardian: null,
  personId: "person-student-1",
  person: {
    fullName: "Academico Signatario",
  },
};
const signerStudentWithGuardian = {
  ...signerStudent,
  guardian: {
    fullName: "Responsavel QA",
    cpf: "98765432100",
    rg: "1234567",
  },
};
const validPresident = {
  id: "board-member-president",
  role: BoardMemberRole.PRESIDENT,
  startedAt: new Date("2026-01-01T00:00:00.000Z"),
  endedAt: null,
  studentId: "student-president-a",
  student: { personId: "person-president-a", person: { fullName: "Presidente A" } },
};
const memberOnly = {
  ...validPresident,
  id: "board-member-member",
  role: BoardMemberRole.MEMBER,
  student: { person: { fullName: "Membro A" } },
};
const legacyWithoutRole = {
  ...validPresident,
  id: "board-member-legacy",
  role: null,
  student: { person: { fullName: "Legado sem cargo" } },
};
const issuedAt = new Date("2026-08-06T12:00:00.000Z");

const studentSigner = await makeService([]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.TERMINATION_LETTER).signers,
  signerStudent,
  issuedAt,
);
assert.equal(studentSigner[0]?.name, "Academico Signatario");
assert.equal(studentSigner[0]?.source, "STUDENT");
assert.equal(studentSigner[0]?.role, "ACADEMICO");
assert.equal(studentSigner[0]?.signerName, "Academico Signatario");
assert.equal(studentSigner[0]?.signerRoleLabel, "Associado");
assert.equal(studentSigner[0]?.signerStudentId, "student-1");
assert.equal(studentSigner[0]?.signerPersonId, "person-student-1");
assert.equal(studentSigner[0]?.resolvedAt, issuedAt.toISOString());

const boardSigner = await makeService([validPresident]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.TERMINATION_TERM).signers,
  signerStudent,
  issuedAt,
);
assert.equal(boardSigner[0]?.name, "Presidente A");
assert.equal(boardSigner[0]?.role, BoardMemberRole.PRESIDENT);
assert.equal(boardSigner[0]?.boardMemberId, "board-member-president");
assert.equal(boardSigner[0]?.signerName, "Presidente A");
assert.equal(boardSigner[0]?.signerRole, BoardMemberRole.PRESIDENT);
assert.equal(boardSigner[0]?.signerRoleLabel, "Presidente");
assert.equal(boardSigner[0]?.signerStudentId, "student-president-a");
assert.equal(boardSigner[0]?.signerPersonId, "person-president-a");
assert.equal(boardSigner[0]?.startedAt, "2026-01-01T00:00:00.000Z");
assert.equal(boardSigner[0]?.endedAt, null);

const institutionalSigner = await makeService([validPresident]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.INTERNAL_REGULATION).signers,
  null,
  issuedAt,
);
assert.equal(institutionalSigner[0]?.name, "Presidente A");
assert.equal(institutionalSigner[0]?.role, BoardMemberRole.PRESIDENT);
assert.equal(institutionalSigner[0]?.signerSource, "BOARD_ROLE");

const annualClearanceSigner = await makeService([validPresident]).resolveSigners(
  getOfficialDocumentDefinition(
    OfficialDocumentType.ANNUAL_CLEARANCE_DECLARATION,
  ).signers,
  signerStudent,
  issuedAt,
);
assert.equal(annualClearanceSigner.length, 1);
assert.equal(annualClearanceSigner[0]?.role, BoardMemberRole.PRESIDENT);
assert.equal(annualClearanceSigner[0]?.source, "BOARD_ROLE");

const adhesionSigners = await makeService([validPresident]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.ADHESION_TERM).signers,
  signerStudentWithGuardian,
  issuedAt,
);
assert.equal(adhesionSigners.length, 3);
assert.equal(adhesionSigners[0]?.role, BoardMemberRole.PRESIDENT);
assert.equal(adhesionSigners[1]?.role, "ACADEMICO");
assert.equal(adhesionSigners[2]?.name, "Responsavel QA");
assert.equal(adhesionSigners[2]?.source, "GUARDIAN");

const adhesionSignersWithoutGuardian = await makeService([validPresident]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.ADHESION_TERM).signers,
  signerStudent,
  issuedAt,
);
assert.equal(adhesionSignersWithoutGuardian.length, 2);

const transportSigners = await makeService([validPresident]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.TRANSPORT_REGULATION).signers,
  signerStudentWithGuardian,
  issuedAt,
);
assert.equal(transportSigners.length, 3);
assert.equal(transportSigners[0]?.role, BoardMemberRole.PRESIDENT);
assert.equal(transportSigners[1]?.source, "STUDENT");
assert.equal(transportSigners[2]?.source, "GUARDIAN");

const transportSignersWithoutGuardian = await makeService([validPresident]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.TRANSPORT_REGULATION).signers,
  signerStudent,
  issuedAt,
);
assert.equal(transportSignersWithoutGuardian.length, 2);

const refundSigners = await makeService([]).resolveSigners(
  getOfficialDocumentDefinition(OfficialDocumentType.TRANSPORT_REFUND_REQUEST).signers,
  signerStudentWithGuardian,
  issuedAt,
);
assert.equal(refundSigners.length, 1);
assert.equal(refundSigners[0]?.role, "ACADEMICO");
assert.equal(refundSigners[0]?.source, "STUDENT");

await assert.rejects(
  () =>
    makeService([]).resolveSigners(
      getOfficialDocumentDefinition(OfficialDocumentType.TERMINATION_TERM).signers,
      signerStudent,
      issuedAt,
    ),
  (error) =>
    error instanceof BadRequestException &&
    JSON.stringify(error.getResponse()).includes("diretoria vigente"),
);
await assert.rejects(
  () =>
    makeService([memberOnly]).resolveSigners(
      getOfficialDocumentDefinition(OfficialDocumentType.TERMINATION_TERM).signers,
      signerStudent,
      issuedAt,
    ),
  (error) =>
    error instanceof BadRequestException &&
    JSON.stringify(error.getResponse()).includes("nao possui presidente"),
);
await assert.rejects(
  () =>
    makeService([legacyWithoutRole]).resolveSigners(
      getOfficialDocumentDefinition(OfficialDocumentType.TERMINATION_TERM).signers,
      signerStudent,
      issuedAt,
    ),
  (error) =>
    error instanceof BadRequestException &&
    JSON.stringify(error.getResponse()).includes("nao possui presidente"),
);
await assert.rejects(
  () =>
    makeService([validPresident, { ...validPresident, id: "president-2" }]).resolveSigners(
      getOfficialDocumentDefinition(OfficialDocumentType.TERMINATION_TERM).signers,
      signerStudent,
      issuedAt,
    ),
  (error) =>
    error instanceof BadRequestException &&
    JSON.stringify(error.getResponse()).includes("mais de um presidente"),
);

const reissuedSnapshot = makeService([]).reissueSnapshot(
  {
    contentSnapshot: {
      documentType: OfficialDocumentType.TERMINATION_TERM,
      emittedAt: "2026-01-01T12:00:00.000Z",
      protocol: "ATRETU-2026-OLD",
      qrPayload: "ATRETU:ATRETU-2026-OLD",
      signers: [boardSigner[0]!],
      signatureName: "Presidente A",
    },
    documentType: OfficialDocumentType.TERMINATION_TERM,
  },
  new Date("2026-09-01T12:00:00.000Z"),
  "ATRETU-2026-NEW",
) as { protocol: string; signers: Array<{ name: string; signerName: string }> };
assert.equal(reissuedSnapshot.protocol, "ATRETU-2026-NEW");
assert.equal(reissuedSnapshot.signers[0]?.name, "Presidente A");
assert.equal(reissuedSnapshot.signers[0]?.signerName, "Presidente A");

const dateService = makeService([]);
assert.equal(
  dateService.addMonthsClamped(new Date("2026-01-31T12:00:00.000Z"), 1).toISOString(),
  "2026-02-28T12:00:00.000Z",
);
assert.equal(
  dateService.addMonthsClamped(new Date("2028-01-31T12:00:00.000Z"), 1).toISOString(),
  "2028-02-29T12:00:00.000Z",
);
assert.equal(
  dateService.addMonthsClamped(new Date("2026-01-31T12:00:00.000Z"), 2).toISOString(),
  "2026-03-31T12:00:00.000Z",
);
assert.equal(
  dateService.addMonthsClamped(new Date("2026-08-06T12:00:00.000Z"), 3).toISOString(),
  "2026-11-06T12:00:00.000Z",
);

function paragraphBlocks(body: string[]): OfficialDocumentPdfBlock[] {
  return body.map((text) => ({ text, type: "paragraph" }));
}

function basePdfInput(body: string[]): OfficialDocumentPdfInput {
  return {
    body: paragraphBlocks(body),
    documentTitle: "Carta de Desligamento",
    emittedAt: new Date("2026-08-06T12:00:00.000Z"),
    emittedBy: "QA Oficial",
    footerNote:
      "ASSOCIACAO DE TRANSPORTE UNIVERSITARIO DE TERRA RICA | CNPJ 00.000.000/0001-00 | Avenida dos Universitarios, 1234 - Centro - Terra Rica/PR | Telefone (44) 99999-9999 - contato@atretu.org.br",
    associationCnpj: "00.000.000/0001-00",
    associationName: "ASSOCIACAO DE TRANSPORTE UNIVERSITARIO DE TERRA RICA",
    protocol: "ATRETU-2026-QA",
    qrPayload: "ATRETU:ATRETU-2026-QA:TERMINATION_LETTER",
    signatureLabel: "Terra Rica, 06/08/2026",
    signatureName: "Academico QA Documentos",
    studentName: "Academico QA Documentos",
    version: 1,
  };
}

function runCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${command} failed: ${result.stderr}`);
  return result.stdout;
}

async function renderPdf(input: OfficialDocumentPdfInput) {
  const dir = mkdtempSync(path.join(tmpdir(), "atretu-official-documents-spec-"));
  const filePath = path.join(dir, "documento.pdf");
  const pdf = await pdfBuilder.render(input);
  writeFileSync(filePath, pdf);
  return {
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
    filePath,
  };
}

async function pageCount(input: OfficialDocumentPdfInput) {
  const rendered = await renderPdf(input);
  try {
    const info = runCommand("pdfinfo", [rendered.filePath]);
    const pages = info.match(/^Pages:\s+(\d+)/m)?.[1];
    assert.ok(pages, "pdfinfo must report page count");
    return Number(pages);
  } finally {
    rendered.cleanup();
  }
}

async function pdfPages(input: OfficialDocumentPdfInput) {
  const rendered = await renderPdf(input);
  try {
    const info = runCommand("pdfinfo", [rendered.filePath]);
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
    assert.ok(pages, "pdfinfo must report page count");
    return {
      pages: Array.from({ length: pages }, (_, index) =>
        runCommand("pdftotext", [
          "-f",
          String(index + 1),
          "-l",
          String(index + 1),
          rendered.filePath,
          "-",
        ]),
      ),
      totalPages: pages,
    };
  } finally {
    rendered.cleanup();
  }
}

async function pdfText(input: OfficialDocumentPdfInput) {
  const rendered = await renderPdf(input);
  try {
    return runCommand("pdftotext", [rendered.filePath, "-"]);
  } finally {
    rendered.cleanup();
  }
}

function countText(source: string, value: string) {
  return source.split(value).length - 1;
}

function normalizePdfText(source: string) {
  return source.replace(/\s+/g, " ").trim();
}

async function assertGlobalPdfStandard(input: OfficialDocumentPdfInput) {
  const { pages, totalPages } = await pdfPages(input);
  const allText = pages.join("\n---PAGE---\n");
  const normalizedFirstPage = normalizePdfText(pages[0] ?? "");
  const normalizedTitle = normalizePdfText(input.documentTitle.toUpperCase());
  assert.ok(
    normalizedFirstPage.includes(normalizedTitle),
    `${input.documentTitle} title/header must be on the first page`,
  );
  pages.slice(1, -1).forEach((page, index) => {
    const topOfPage = normalizePdfText(page).slice(0, 260);
    assert.ok(
      !topOfPage.includes(normalizedTitle),
      `${input.documentTitle} title/header must not repeat on page ${index + 2}`,
    );
    if (input.associationCnpj) {
      assert.ok(
        !topOfPage.includes(`CNPJ ${input.associationCnpj}`),
        `${input.documentTitle} institutional header must not repeat on page ${index + 2}`,
      );
    }
  });
  assert.equal(
    countText(allText, "Emitido por"),
    1,
    `${input.documentTitle} must render the institutional footer only once`,
  );
  assert.ok(
    pages[totalPages - 1]?.includes("Emitido por"),
    `${input.documentTitle} footer must be on the last page`,
  );
  assert.ok(
    !allText.includes(input.protocol),
    `${input.documentTitle} must not render the technical protocol`,
  );
  assert.ok(
    !allText.includes(input.qrPayload),
    `${input.documentTitle} must not render the QR payload`,
  );
  assert.ok(
    !/\bPROTOCOLO\b/.test(allText),
    `${input.documentTitle} must not render the protocol metadata label`,
  );
  assert.ok(
    !/\bVERS[ÃA]O\b/.test(allText),
    `${input.documentTitle} must not render the version metadata label`,
  );
  assert.ok(
    !/\bDATA\b/.test(allText),
    `${input.documentTitle} must not render the technical date metadata label`,
  );
  assert.ok(
    !allText.includes("QR preparado"),
    `${input.documentTitle} must not render the QR block`,
  );
  assert.match(
    allText,
    /Presidente QA|Academico QA|Responsavel QA/i,
    `${input.documentTitle} must keep signatures visible`,
  );
}

async function assertNoHeaderOnlyPages(input: OfficialDocumentPdfInput) {
  const rendered = await renderPdf(input);
  try {
    const info = runCommand("pdfinfo", [rendered.filePath]);
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
    for (let page = 1; page <= pages; page += 1) {
      const text = runCommand("pdftotext", [
        "-f",
        String(page),
        "-l",
        String(page),
        rendered.filePath,
        "-",
      ])
        .replace(/\s+/g, " ")
        .trim();
      assert.match(
        text,
        /Carta de Desligamento|paragrafo de regressao|Academico QA Documentos|REGIMENTO|DIRETRIZES|TRANSPORTE|Art\.|Presidente QA|Termo de Adesão|Cláusula|Academico QA Adesao|Academico QA Transporte|Reembolso|Academico QA Reembolso|Quitação Anual|Academico QA Quitacao/i,
        `page ${page} must include document content, not only header/footer`,
      );
    }
  } finally {
    rendered.cleanup();
  }
}

const shortLetterBody = [
  "Declaramos, para os devidos fins, que o academico Academico QA Documentos encontra-se desligado da Associacao de Transporte Universitario de Terra Rica, conforme registros administrativos oficiais mantidos pela entidade.",
  "A presente carta e emitida a pedido do interessado para comprovar sua situacao cadastral junto a ATRETU.",
];
const longAddressLetterBody = [
  ...shortLetterBody,
  "Endereco cadastrado: Avenida dos Universitarios, quadra academica administrativa, numero 1234, bloco institucional, sala de atendimento ao academico, bairro Centro, Terra Rica, Parana, CEP 87890-000.",
];
const longLetterBody = Array.from({ length: 34 }, (_, index) =>
  `Paragrafo de regressao ${index + 1}: este conteudo simula um documento oficial realmente longo para validar paginacao minima, sem paginas vazias e sem cabecalho ou rodape isolados.`,
);

assert.equal(
  await pageCount(basePdfInput(shortLetterBody)),
  1,
  "short termination letter must fit in one A4 page",
);
assert.equal(
  await pageCount(basePdfInput(longAddressLetterBody)),
  1,
  "termination letter with long address must still fit in one A4 page",
);
const longPages = await pageCount(basePdfInput(longLetterBody));
assert.ok(longPages > 1, "really long official document must create extra pages");
assert.ok(longPages < 8, "really long official document must not create header/footer-only pages");
await assertNoHeaderOnlyPages(basePdfInput(longLetterBody));
await assertGlobalPdfStandard(basePdfInput(longLetterBody));

const dynamicSignatureModes = [
  {
    mode: OfficialDocumentDynamicSignatureMode.NONE,
    signatures: null,
    expected: [],
  },
  {
    mode: OfficialDocumentDynamicSignatureMode.STUDENT,
    signatures: [{ label: "Acadêmico", name: "Assinatura Academico QA" }],
    expected: ["Assinatura Academico QA", "Acadêmico"],
  },
  {
    mode: OfficialDocumentDynamicSignatureMode.BOARD,
    signatures: [{ label: "Presidente · ATRETU", name: "Assinatura Diretoria QA" }],
    expected: ["Assinatura Diretoria QA", "Presidente", "ATRETU"],
  },
  {
    mode: OfficialDocumentDynamicSignatureMode.STUDENT_BOARD,
    signatures: [
      { label: "Acadêmico", name: "Assinatura Academico QA" },
      { label: "Presidente · ATRETU", name: "Assinatura Diretoria QA" },
    ],
    expected: ["Assinatura Academico QA", "Assinatura Diretoria QA"],
  },
];

for (const { expected, mode, signatures } of dynamicSignatureModes) {
  const input: OfficialDocumentPdfInput = {
    ...basePdfInput(["Conteudo de modelo dinamico para validar assinatura fisica."]),
    documentTitle: `Modelo Dinamico ${mode}`,
    protocol: `ATRETU-2026-${mode}`,
    qrPayload: `ATRETU:ATRETU-2026-${mode}:DYNAMIC_TEMPLATE`,
    signatureName: "Assinatura Oculta QA",
    signatures,
    signatureTitle: "Assinatura Oculta",
    subjectName: "Documento dinamico QA",
    studentName: "Documento dinamico QA",
  };
  assert.equal(
    await pageCount(input),
    1,
    `${mode} dynamic model signature preview must fit in one A4 page`,
  );
  const text = await pdfText(input);
  if (mode === OfficialDocumentDynamicSignatureMode.NONE) {
    assert.ok(!text.includes("Assinatura Oculta QA"));
    assert.ok(!text.includes("Assinatura Academico QA"));
    assert.ok(!text.includes("Assinatura Diretoria QA"));
  }
  for (const value of expected) {
    assert.ok(text.includes(value), `${mode} PDF must include ${value}`);
  }
}

const internalRegulationInput: OfficialDocumentPdfInput = {
  body: internalRegulationBody(),
  documentTitle: INTERNAL_REGULATION_DOCUMENT_TITLE,
  emittedAt: new Date("2026-08-06T12:00:00.000Z"),
  emittedBy: "QA Oficial",
  footerNote:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
  associationCnpj: "49.682.667/0001-00",
  associationName:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS",
  layout: "compact",
  protocol: "ATRETU-2026-REG",
  qrPayload: "ATRETU:ATRETU-2026-REG:INTERNAL_REGULATION",
  signatureLabel: "Terra Rica, 20 de dezembro de 2022.",
  signatureName: "Presidente QA",
  signatureTitle: "Presidente da ATRETU",
  studentName: "ATRETU",
  subjectLabel: "Documento",
  subjectName: "ATRETU",
  version: 1,
};
const internalRegulationPages = await pageCount(internalRegulationInput);
assert.ok(
  internalRegulationPages >= 5 && internalRegulationPages <= 7,
  "internal regulation must stay close to the legacy page count",
);
await assertNoHeaderOnlyPages(internalRegulationInput);
await assertGlobalPdfStandard(internalRegulationInput);

const adhesionTermInput: OfficialDocumentPdfInput = {
  body: adhesionTermBody({
    installmentAmount: "R$ 330,00",
    installmentAmountWords: "trezentos e trinta reais",
    installmentCount: 4,
    installmentCountWords: "quatro",
    installmentDueDay: 6,
    installments: Array.from({ length: 4 }, (_, index) => ({
      amountText: "R$ 330,00",
      dateText: `06/${String(index + 8).padStart(2, "0")}/2026`,
      label: `${index + 1}ª Mensalidade`,
    })),
    totalContractAmount: "R$ 1.320,00",
    student: {
      address: "Rua QA, 123",
      birthDate: "11/04/2007",
      cpf: "141.434.829-08",
      course: "DIREITO",
      email: "qa@atretu.test",
      fullName: "Academico QA Adesao",
      grade: "1",
      institution: "UNIFATECIE BR",
      phone: "(44) 99999-9999",
      rg: "165454073",
      shift: "NOTURNO",
    },
  }),
  documentTitle: ADHESION_TERM_DOCUMENT_TITLE,
  emittedAt: new Date("2026-08-06T12:00:00.000Z"),
  emittedBy: "QA Oficial",
  footerNote:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
  associationCnpj: "49.682.667/0001-00",
  associationName:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS",
  protocol: "ATRETU-2026-ADESAO",
  qrPayload: "ATRETU:ATRETU-2026-ADESAO:ADHESION_TERM",
  signatureLabel: "Terra Rica, 06/08/2026",
  signatureName: "Presidente QA",
  signatures: [
    { label: "Presidente da ATRETU", name: "Presidente QA" },
    { label: "Associado | CPF: 141.434.829-08 | RG: 165454073", name: "Academico QA Adesao" },
    { label: "Responsavel | CPF: 987.654.321-00 | RG: 1234567", name: "Responsavel QA" },
  ],
  studentName: "Academico QA Adesao",
  subjectLabel: "Academico",
  subjectName: "Academico QA Adesao",
  version: 1,
};
const adhesionFinancialClause = JSON.stringify(adhesionTermInput.body);
assert.ok(adhesionFinancialClause.includes("4 (quatro) parcelas"));
assert.ok(adhesionFinancialClause.includes("R$ 330,00"));
assert.ok(adhesionFinancialClause.includes("trezentos e trinta reais"));
assert.ok(adhesionFinancialClause.includes("R$ 1.320,00"));
assert.equal(
  adhesionTermInput.body
    .filter((block) => block.type === "table")
    .flatMap((block) => block.rows).length,
  4,
);
const adhesionPages = await pageCount(adhesionTermInput);
assert.ok(adhesionPages >= 1 && adhesionPages <= 3, "adhesion term must render in a compact A4 flow");
await assertNoHeaderOnlyPages(adhesionTermInput);
await assertGlobalPdfStandard(adhesionTermInput);

const annualClearanceInput: OfficialDocumentPdfInput = {
  body: annualClearanceDeclarationBody({
    finalClearanceDate: "15/11/2026",
    issuePlaceDateText: "Terra Rica - PR, 08 de agosto de 2026.",
    periodEnd: "31 de dezembro de 2026",
    periodStart: "01 de janeiro de 2026",
    presidentName: "Presidente QA",
    student: {
      cpf: "115.932.699-19",
      fullName: "Academico QA Quitacao",
    },
    totalAmount: "R$ 300,00",
    totalAmountWords: "trezentos reais",
    year: 2026,
  }),
  documentTitle: ANNUAL_CLEARANCE_DECLARATION_DOCUMENT_TITLE,
  emittedAt: new Date("2026-08-08T12:00:00.000Z"),
  emittedBy: "QA Oficial",
  footerNote:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
  associationCnpj: "49.682.667/0001-00",
  associationName:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS",
  layout: "compact",
  protocol: "ATRETU-2026-QUIT",
  qrPayload: "ATRETU:ATRETU-2026-QUIT:ANNUAL_CLEARANCE_DECLARATION",
  signatureLabel: "",
  signatureName: "Presidente QA",
  signatures: [{ label: "Presidente da ATRETU", name: "Presidente QA" }],
  studentName: "Academico QA Quitacao",
  subjectLabel: "Academico",
  subjectName: "Academico QA Quitacao",
  version: 1,
};
const annualClearanceBody = JSON.stringify(annualClearanceInput.body);
assert.ok(annualClearanceBody.includes("exercício do ano de 2026"));
assert.ok(annualClearanceBody.includes("01 de janeiro de 2026"));
assert.ok(annualClearanceBody.includes("31 de dezembro de 2026"));
assert.ok(annualClearanceBody.includes("R$ 300,00"));
assert.ok(annualClearanceBody.includes("trezentos reais"));
assert.ok(annualClearanceBody.includes("Data da quitação final: 15/11/2026"));
assert.ok(!annualClearanceBody.includes("Data da quitação final: 20/12/2026"));
assert.ok(annualClearanceBody.includes("Terra Rica - PR, 08 de agosto de 2026."));
assert.equal(
  await pageCount(annualClearanceInput),
  1,
  "annual clearance declaration must fit in one A4 page",
);
await assertNoHeaderOnlyPages(annualClearanceInput);
await assertGlobalPdfStandard(annualClearanceInput);

const transportRegulationInput: OfficialDocumentPdfInput = {
  body: transportRegulationBody({
    issuePlaceDateText: "Terra Rica, 06 de agosto de 2026",
    guardian: {
      cpf: "987.654.321-00",
      fullName: "Responsavel QA",
      rg: "1234567",
    },
    president: {
      label: "Presidente da ATRETU",
      name: "Presidente QA",
    },
    student: {
      cpf: "141.434.829-08",
      fullName: "Academico QA Transporte",
      rg: "165454073",
    },
  }),
  documentTitle: TRANSPORT_REGULATION_DOCUMENT_TITLE,
  emittedAt: new Date("2026-08-06T12:00:00.000Z"),
  emittedBy: "QA Oficial",
  footerNote:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
  associationCnpj: "49.682.667/0001-00",
  associationName:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS",
  layout: "compact",
  protocol: "ATRETU-2026-TRANSP",
  qrPayload: "ATRETU:ATRETU-2026-TRANSP:TRANSPORT_REGULATION",
  signatureLabel: "Terra Rica, 06/08/2026",
  signatureName: "Presidente QA",
  signaturePlacement: "body",
  signatures: [
    { label: "Presidente da ATRETU", name: "Presidente QA" },
    { label: "Associado", name: "Academico QA Transporte" },
    { label: "Responsavel", name: "Responsavel QA" },
  ],
  studentName: "Academico QA Transporte",
  subjectLabel: "Academico",
  subjectName: "Academico QA Transporte",
  version: 1,
};
const transportBody = JSON.stringify(transportRegulationInput.body);
assert.ok(transportBody.includes("AEUA"));
assert.ok(transportBody.includes("R$ 150,00"));
assert.ok(transportBody.includes("Terra Rica, 06 de agosto de 2026"));
assert.ok(!transportBody.includes("Terra Rica, 16 de dezembro de 2023"));
assert.ok(transportBody.includes("TERMO DE CIENCIA DO REGIMENTO DO TRANSPORTE"));
assert.ok(transportBody.includes("QUANDO INTERESSADO FOR MENOR DE IDADE"));
const transportPages = await pageCount(transportRegulationInput);
assert.equal(transportPages, 3, "transport regulation must stay at the legacy 3 pages");
await assertNoHeaderOnlyPages(transportRegulationInput);
await assertGlobalPdfStandard(transportRegulationInput);

const refundRequestInput: OfficialDocumentPdfInput = {
  body: transportRefundRequestBody({
    issuePlaceDateText: "Terra Rica, 07 de agosto de 2026",
    payment: {
      method: "PIX",
      methodText: "PIX",
      pixKey: "academico.qa@pix.test",
    },
    reason: "mudanca de rota autorizada pela secretaria",
    refundAmount: "R$ 200,00",
    refundAmountWords: "duzentos reais",
    student: {
      academicYear: "5°Ano",
      address: "SITIO SAO PEDRO, Terra Rica, PR",
      cpf: "428.245.098-30",
      email: "qa@atretu.test",
      fullName: "Academico QA Reembolso",
      institution: "UNIFATECIE CENTRO",
      phone: "(44) 99999-9999",
    },
  }),
  documentTitle: TRANSPORT_REFUND_REQUEST_DOCUMENT_TITLE,
  emittedAt: new Date("2026-08-07T12:00:00.000Z"),
  emittedBy: "QA Oficial",
  footerNote:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
  associationCnpj: "49.682.667/0001-00",
  associationName:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS",
  protocol: "ATRETU-2026-REEMB",
  qrPayload: "ATRETU:ATRETU-2026-REEMB:TRANSPORT_REFUND_REQUEST",
  signatureLabel: "",
  signatureName: "Academico QA Reembolso",
  signatures: [
    {
      label: "Associado | CPF: 428.245.098-30 | RG: 1234567",
      name: "Academico QA Reembolso",
    },
  ],
  studentName: "Academico QA Reembolso",
  subjectLabel: "Academico",
  subjectName: "Academico QA Reembolso",
  version: 1,
};
const refundBody = JSON.stringify(refundRequestInput.body);
assert.ok(refundBody.includes("R$ 200,00"));
assert.ok(refundBody.includes("duzentos reais"));
assert.ok(refundBody.includes("academico.qa@pix.test"));
assert.ok(!refundBody.includes("duzentos reais referente") || refundBody.includes("R$ 200,00"));
assert.ok(!refundBody.includes("Aleixo Tur"));
assert.ok(!refundBody.includes("Terra Ria"));
assert.ok(refundBody.includes("Terra Rica, 07 de agosto de 2026"));
assert.equal(await pageCount(refundRequestInput), 1, "refund request must fit in one A4 page");
await assertNoHeaderOnlyPages(refundRequestInput);
await assertGlobalPdfStandard(refundRequestInput);

console.log("Official documents infrastructure guard OK");
