import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { BoardMemberRole, OfficialDocumentType } from "@prisma/client";
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
const internalRegulation = readFileSync(
  new URL("./internal-regulation.content.ts", import.meta.url),
  "utf8",
);
const adhesionTerm = readFileSync(
  new URL("./adhesion-term.content.ts", import.meta.url),
  "utf8",
);
const transportRegulation = readFileSync(
  new URL("./transport-regulation.content.ts", import.meta.url),
  "utf8",
);
const appModule = readFileSync(new URL("../app.module.ts", import.meta.url), "utf8");

for (const fragment of [
  "enum OfficialDocumentType",
  "TERMINATION_LETTER",
  "ADHESION_TERM",
  "TRANSPORT_REGULATION",
  "TERMINATION_TERM",
  "INTERNAL_REGULATION",
  "model OfficialDocumentIssue",
  "studentId       String?",
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
  '@Controller("official-documents/institutional")',
  "IssueInstitutionalOfficialDocumentDto",
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
  "listInstitutionalOfficialDocuments",
  "signerPreview",
  "issueInstitutionalDocument",
  "reissueInstitutionalDocument",
  "buildInstitutionalSnapshot",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_ISSUED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_REISSUED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_VIEWED",
  "AdministrativeAuditEventType.OFFICIAL_DOCUMENT_DOWNLOADED",
  "source.documentType",
  "resolveTerminationTermPayload",
  "resolveAdhesionTermPayload",
  "buildAdhesionTermSnapshot",
  "buildTransportRegulationSnapshot",
  "transportRegulationBody",
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
  "templateKey: \"transport-regulation\"",
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
  "Regimento do Transporte",
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
  ) as never as {
    addMonthsClamped: (value: Date, monthsToAdd: number) => Date;
    reissueSnapshot: (...args: unknown[]) => unknown;
    resolveSigners: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  };
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
        /Carta de Desligamento|paragrafo de regressao|Academico QA Documentos|REGIMENTO|DIRETRIZES|TRANSPORTE|Art\.|Presidente QA|Termo de Adesão|Cláusula|Academico QA Adesao|Academico QA Transporte/i,
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

const internalRegulationInput: OfficialDocumentPdfInput = {
  body: internalRegulationBody(),
  documentTitle: INTERNAL_REGULATION_DOCUMENT_TITLE,
  emittedAt: new Date("2026-08-06T12:00:00.000Z"),
  emittedBy: "QA Oficial",
  footerNote:
    "ASSOCIAÇÃO TERRA-RIQUENSE DE ESTUDANTES TÉCNICOS E UNIVERSITÁRIOS CNPJ 49.682.667/0001-00 | Av. Claudio Domingos Soletti, 1276, Centro CEP 87890-000 Terra Rica PR FONE:44 99941-3565 44 99144-1176 email - atretu2022@gmail.com",
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

console.log("Official documents infrastructure guard OK");
