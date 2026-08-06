import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  OfficialDocumentPdfBuilder,
  type OfficialDocumentPdfInput,
} from "./official-document-pdf.builder.js";

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
  "Nao existe uma diretoria ativa com presidente configurado",
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

const pdfBuilder = new OfficialDocumentPdfBuilder();

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
