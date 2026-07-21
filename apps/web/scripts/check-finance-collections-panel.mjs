import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/app/admin/collections-panel.tsx", "utf8");
const financePanel = readFileSync("src/app/admin/finance-panel.tsx", "utf8");
const api = readFileSync("src/lib/api.ts", "utf8");
const formatters = readFileSync("src/app/admin/collection-formatters.ts", "utf8");

const includesAll = (source, values) => {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
};

includesAll(financePanel, [
  "CollectionsPanel",
  "Cobranca e Inadimplencia",
  "canViewCollections",
  'financeArea === "collections"',
]);

includesAll(api, [
  "export type CollectionSummary",
  "export type CollectionCase",
  "export type CollectionCaseDetail",
  "export type CollectionAction",
  "export type CollectionFollowUp",
  "export type CollectionAgingBucket",
  "export type CollectionOperationalStatus",
  "export type CollectionPriority",
  "getCollectionSummary",
  "listCollectionCases",
  "getCollectionCase",
  "listCollectionActions",
  "listCollectionFollowUps",
  "/finance/collections/summary",
  "/finance/collections/cases",
  "/finance/collections/follow-ups",
]);

includesAll(panel, [
  "api.getCollectionSummary",
  "api.listCollectionCases",
  "api.getCollectionCase",
  "api.listCollectionActions",
  "api.listCollectionFollowUps",
  "api.getInvoiceBankSlip",
  "api.downloadInvoiceBankSlipPdf",
  "setPage(1)",
  "current.search === nextSearch",
  "current === 1 ? current : 1",
  "requestSeq",
  "casesResponse.pagination.total",
  "casesResponse.pagination.totalPages",
  "Nenhuma fatura vencida encontrada",
  "Nenhuma acao registrada",
  "Pagamento parcial em revisao",
  "Fatura sem boleto",
  "PDF ainda nao arquivado",
  "Sem telefone",
  "Sem e-mail",
  "Sem permissao para acessar Cobranca e Inadimplencia",
  "Erro ao carregar cobranca",
  "overflow-x-auto",
  "md:grid-cols",
  "max-w-4xl",
]);

includesAll(panel, [
  "institutionId",
  "academicYearId",
  "search",
  "dueDateFrom",
  "dueDateTo",
  "agingBucket",
  "operationalStatus",
  "actionType",
  "followUpFrom",
  "followUpTo",
  "page",
  "limit: 10",
]);

includesAll(formatters, [
  "DAYS_1_30",
  "DAYS_31_60",
  "DAYS_61_90",
  "DAYS_90_PLUS",
  "OVERDUE_NO_ACTION",
  "CONTACTED",
  "PROMISE_ACTIVE",
  "PROMISE_BROKEN",
  "FOLLOW_UP_SCHEDULED",
  "NO_CONTACT",
  "PARTIAL_PAYMENT_REVIEW",
  "NORMAL",
  "HIGH",
  "CRITICAL",
]);

assert.equal(
  panel.includes("createCollectionAction"),
  false,
  "The read-only collections panel must not call the action creation API",
);
assert.equal(
  panel.includes('method: "POST"'),
  false,
  "The read-only collections panel must not issue POST requests",
);
for (const forbidden of [
  "api.syncInvoiceBankSlip",
  "api.issueInvoiceBankSlip",
  "api.cancelInvoiceBankSlip",
  "api.cancelInvoice",
  "api.syncPaidBankSlipsDay",
  "createCollectionAction",
  "Consultar Sicredi",
  "Emitir boleto",
  "Cancelar boleto",
  "Dar baixa",
]) {
  assert.equal(
    panel.includes(forbidden),
    false,
    `The read-only collections panel must not use ${forbidden}`,
  );
}

console.log("Finance collections panel OK");
