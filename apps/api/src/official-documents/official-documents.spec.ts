import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { BoardMemberRole, OfficialDocumentType } from "@prisma/client";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  OfficialDocumentPdfBuilder,
  type OfficialDocumentPdfInput,
} from "./official-document-pdf.builder.js";
import { OfficialDocumentsService } from "./official-documents.service.js";
import { getOfficialDocumentDefinition } from "./official-document.registry.js";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const controller = readFileSync(
  new URL("./official-documents.controller.ts", import.meta.url),
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
const appModule = readFileSync(new URL("../app.module.ts", import.meta.url), "utf8");

for (const fragment of [
  "enum OfficialDocumentType",
  "TERMINATION_LETTER",
  "TERMINATION_TERM",
  "model OfficialDocumentIssue",
  "templateKey",
  "templateVersion",
  "notes",
  "role            BoardMemberRole?",
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
  '@Patch("students/:id/board-memberships/:membershipId/role")',
  "@Roles(RoleCode.SUPER_ADMIN)",
  "updateBoardMembershipRole",
]) {
  assert.ok(studentsController.includes(fragment), `students controller must include ${fragment}`);
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
  "resolveSigners",
  "resolveBoardRoleSigner",
  "status: BoardMembershipStatus.ACTIVE",
  "role: { not: null }",
  "startedAt: { lte: issuedAt }",
  "endedAt: { gte: issuedAt }",
  "signerRoleLabel",
  "signerStudentId",
  "resolvedAt",
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
  "templateKey: \"termination-term\"",
  "templateVersion: 1",
  "StudentStatus.TERMINATED",
  "source: \"STUDENT\"",
  "source: \"BOARD_ROLE\"",
  "BoardMemberRole.PRESIDENT",
  "Presidente da ATRETU",
  "Termo de Desligamento",
]) {
  assert.ok(registry.includes(fragment), `registry must include ${fragment}`);
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
  ) as never as {
    reissueSnapshot: (...args: unknown[]) => unknown;
    resolveSigners: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  };
}

const signerStudent = {
  id: "student-1",
  personId: "person-student-1",
  person: {
    fullName: "Academico Signatario",
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

function basePdfInput(body: string[]): OfficialDocumentPdfInput {
  return {
    body,
    documentTitle: "Carta de Desligamento",
    emittedAt: new Date("2026-08-06T12:00:00.000Z"),
    emittedBy: "QA Oficial",
    footerNote:
      "ASSOCIACAO DE TRANSPORTE UNIVERSITARIO DE TERRA RICA | CNPJ 00.000.000/0001-00 | Avenida dos Universitarios, 1234 - Centro - Terra Rica/PR | Telefone (44) 99999-9999 - contato@atretu.org.br",
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
        /Carta de Desligamento|paragrafo de regressao|Academico QA Documentos/i,
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

console.log("Official documents infrastructure guard OK");
