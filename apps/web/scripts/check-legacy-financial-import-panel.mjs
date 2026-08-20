import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const panelSource = readFileSync(
  resolve("src/app/admin/legacy-import-panel.tsx"),
  "utf8",
);
const apiSource = readFileSync(resolve("src/lib/api.ts"), "utf8");

for (const [fragment, message] of [
  ["label=\"Academicos\"", "Legacy import panel must keep the academic tab"],
  [
    "label=\"Historico financeiro\"",
    "Legacy import panel must expose the financial history tab",
  ],
  [
    "Importar somente como histórico financeiro legado",
    "Financial import must require the exact read-only history confirmation",
  ],
  [
    "NAO gera Invoice, BankSlip, Sicredi, cobranca, inadimplencia operacional ou CollectionAction.",
    "Financial import must display the no-operational-effects boundary",
  ],
  [
    "selectedLegacyFinancialIds",
    "Financial import must support individual financial record selection",
  ],
  [
    "resolvedLegacyStudentName",
    "Financial preview must render a friendly resolved student name",
  ],
  [
    "Carteirinha ATRETU:",
    "Financial preview must render the ATRETU card number when available",
  ],
  [
    "Legado:",
    "Financial preview must keep the legacy student id visible",
  ],
  ["Resultado financeiro", "Financial import result panel must be present"],
  [
    "Academico cadastrado - aguardando renovacao",
    "Academic status 3 preview must explain the destination situation",
  ],
  [
    "Matricula preservada",
    "Academic status 3 preview must show the preserved historical enrollment",
  ],
  [
    "Rematricula destino",
    "Academic status 3 preview must state destination reenrollment is pending",
  ],
  [
    "Nao sera emitida enquanto nao houver renovacao",
    "Academic status 3 preview must state no ATRETU card is issued",
  ],
  [
    "Nao sera vinculado enquanto nao houver renovacao",
    "Academic status 3 preview must state no destination bus assignment is created",
  ],
]) {
  assertIncludes(panelSource, fragment, message);
}

for (const [fragment, message] of [
  [
    "\"/admin/legacy-import/financial/analyze\"",
    "API client must call the existing financial analyze endpoint",
  ],
  [
    "\"/admin/legacy-import/financial/import\"",
    "API client must call the existing financial import endpoint",
  ],
]) {
  assertIncludes(apiSource, fragment, message);
}

const financialCard = sourceBetween(
  panelSource,
  "function FinancialPreviewCard",
  "function wait",
);
for (const forbidden of [
  "Academico resolvido:",
  'label="CPF"',
  'label="Instituicao"',
  'label="Curso / serie"',
  'label="Turno"',
  'label="Onibus"',
  'label="Carteirinha legado"',
  'label="Carteirinha ATRETU"',
  'label="Ano letivo destino"',
]) {
  if (financialCard.includes(forbidden)) {
    throw new Error(`Financial preview must not render academic field ${forbidden}`);
  }
}

console.log("Legacy financial import panel guard OK");

function assertIncludes(source, fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message);
  }
}

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error("Could not locate source section");
  }
  return source.slice(startIndex, endIndex);
}
