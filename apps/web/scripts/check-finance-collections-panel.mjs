import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/app/admin/collections-panel.tsx", "utf8");
const collectionList = readFileSync(
  "src/app/admin/finance/collections/collection-list.tsx",
  "utf8",
);
const collectionCard = readFileSync(
  "src/app/admin/finance/collections/collection-card.tsx",
  "utf8",
);
const collectionFilters = readFileSync(
  "src/app/admin/finance/collections/collection-filters.tsx",
  "utf8",
);
const collectionSummary = readFileSync(
  "src/app/admin/finance/collections/collection-summary.tsx",
  "utf8",
);
const collectionDisplayUtils = readFileSync(
  "src/app/admin/finance/collections/collection-display-utils.ts",
  "utf8",
);
const collectionDetails = readFileSync(
  "src/app/admin/finance/collections/collection-details.tsx",
  "utf8",
);
const collectionDetailsHeader = readFileSync(
  "src/app/admin/finance/collections/collection-details-header.tsx",
  "utf8",
);
const collectionFinancialSummary = readFileSync(
  "src/app/admin/finance/collections/collection-financial-summary.tsx",
  "utf8",
);
const collectionBankSlipSection = readFileSync(
  "src/app/admin/finance/collections/collection-bank-slip-section.tsx",
  "utf8",
);
const collectionPromiseSection = readFileSync(
  "src/app/admin/finance/collections/collection-promise-section.tsx",
  "utf8",
);
const collectionFollowUpSection = readFileSync(
  "src/app/admin/finance/collections/collection-follow-up-section.tsx",
  "utf8",
);
const collectionHistory = readFileSync(
  "src/app/admin/finance/collections/collection-history.tsx",
  "utf8",
);
const collectionHistoryItem = readFileSync(
  "src/app/admin/finance/collections/collection-history-item.tsx",
  "utf8",
);
const collectionActionForm = readFileSync(
  "src/app/admin/finance/collections/collection-action-form.tsx",
  "utf8",
);
const collectionActionFields = readFileSync(
  "src/app/admin/finance/collections/collection-action-fields.tsx",
  "utf8",
);
const collectionActionTypeSelector = readFileSync(
  "src/app/admin/finance/collections/collection-action-type-selector.tsx",
  "utf8",
);
const collectionActionFeedback = readFileSync(
  "src/app/admin/finance/collections/collection-action-feedback.tsx",
  "utf8",
);
const collectionActionDisplayUtils = readFileSync(
  "src/app/admin/finance/collections/collection-action-display-utils.ts",
  "utf8",
);
const collectionFollowUpList = readFileSync(
  "src/app/admin/finance/collections/collection-follow-up-list.tsx",
  "utf8",
);
const collectionFollowUpCard = readFileSync(
  "src/app/admin/finance/collections/collection-follow-up-card.tsx",
  "utf8",
);
const financePanel = readFileSync("src/app/admin/finance-panel.tsx", "utf8");
const financeNavigation = readFileSync(
  "src/app/admin/finance/finance-navigation.tsx",
  "utf8",
);
const api = readFileSync("src/lib/api.ts", "utf8");
const formatters = readFileSync("src/app/admin/collection-formatters.ts", "utf8");

const includesAll = (source, values) => {
  for (const value of values) {
    assert.ok(source.includes(value), `Expected source to include ${value}`);
  }
};

includesAll(financePanel, [
  "CollectionsPanel",
  "canViewCollections",
  'financeArea === "collections"',
]);

includesAll(financeNavigation, ["Cobrança e inadimplência"]);

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
  "CollectionDetails",
  "CollectionFollowUpList",
  "setPage(1)",
  "current.search === nextSearch",
  "current === 1 ? current : 1",
  "requestSeq",
  "casesResponse.pagination.total",
  "casesResponse.pagination.totalPages",
  "Sem permissao para acessar Cobranca e Inadimplencia",
  "Erro ao carregar cobranca",
  "max-w-4xl",
  'role="dialog"',
  'aria-modal="true"',
]);

includesAll(collectionList, [
  "Nenhuma fatura vencida encontrada",
  "CollectionCard",
  "Pagina {page} de {totalPages}",
]);

includesAll(collectionCard, [
  "CollectionPriorityBadge",
  "CollectionStatusBadge",
  "formatOutstanding",
  "collectionRiskSignals",
  "onOpenDetail(caseItem.invoiceId)",
]);

includesAll(collectionFilters, [
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
  "hasActiveCollectionFilters",
]);

includesAll(collectionDisplayUtils, [
  "collectionAgingBuckets",
  "collectionOperationalStatuses",
  "formatCents",
  "Pagamento parcial em revisao",
  "collectionInvoiceStatusLabel",
  "latestPromiseAction",
  "latestFollowUpAction",
  "collectionFollowUpState",
]);

includesAll(collectionSummary, [
  "Valor vencido",
  "Promessas ativas",
  "Pagamentos parciais",
]);

includesAll(collectionDetails, [
  "CollectionDetailsHeader",
  "CollectionFinancialSummary",
  "CollectionPromiseSection",
  "CollectionFollowUpSection",
  "CollectionBankSlipSection",
  "CollectionHistory",
  "CollectionActionForm",
  "Faturas pagas ou canceladas nao aceitam novas acoes",
]);

includesAll(collectionActionForm, [
  "api.createCollectionAction",
  "validateCollectionActionForm",
  "validation.body",
  "submittingRef",
  "disabled={submitting}",
  "CollectionActionFeedback",
  "CollectionActionTypeSelector",
  "CollectionActionFields",
]);

includesAll(collectionActionFields, [
  "collectionActionShowsChannel",
  "collectionActionShowsContact",
  "collectionActionShowsPromise",
  "collectionActionShowsFollowUp",
  "promisedAmountReais",
  "promiseDueDate",
  "nextFollowUpAt",
  "contactedDocumentMasked",
]);

includesAll(collectionActionTypeSelector, [
  "collectionActionTypes",
  "collectionActionTypeLabel",
  "collectionActionHelp",
]);

includesAll(collectionActionFeedback, ["AlertCircle", "CheckCircle2"]);

includesAll(collectionActionDisplayUtils, [
  "CONTACT_ATTEMPT",
  "CONTACT_MADE",
  "PROMISE_TO_PAY",
  "FOLLOW_UP_SCHEDULED",
  "NO_CONTACT",
  "PARTIAL_PAYMENT_REVIEW_NOTE",
  "INTERNAL_NOTE",
]);

includesAll(collectionDetailsHeader, [
  "CollectionPriorityBadge",
  "CollectionStatusBadge",
  "caseDetail.priority",
  "caseDetail.operationalStatus",
  "caseDetail.daysOverdue",
  "formatOutstanding",
]);

includesAll(collectionFinancialSummary, [
  "caseDetail.agingBucket",
  "caseDetail.partialPaymentReview",
  "caseDetail.brokenPromise",
  "collectionOperationalStatusLabel",
  "collectionInvoiceStatusLabel",
  "formatCents",
  "Valor original",
  "Valor pago",
  "Valor pendente",
  "Pagamento parcial",
]);

includesAll(collectionBankSlipSection, [
  "Copiar linha digitavel",
  "Baixar PDF",
  "Fatura sem boleto",
  "PDF ainda nao arquivado",
  "bankSlip?.linhaDigitavel",
  "summary?.pdfStoredAt",
  "nossoNumero",
]);

includesAll(collectionPromiseSection, [
  "latestPromiseAction",
  "Promessa ativa",
  "Promessa vencida",
  "Sem promessa",
  "promisedAmountCents",
  "promiseDueDate",
]);

includesAll(collectionFollowUpSection, [
  "Retorno hoje",
  "Retorno vencido",
  "Sem follow-up",
  "caseDetail.nextFollowUpAt",
  "latestFollowUpAction",
]);

includesAll(collectionHistory, [
  "Nenhuma acao registrada",
  "CollectionHistoryItem",
  "Linha do tempo somente leitura",
]);

includesAll(collectionHistoryItem, [
  "contactedDocumentMasked",
  "collectionChannelLabel",
  "action.source",
  "action.note",
  "promisedAmountCents",
  "nextFollowUpAt",
]);

includesAll(collectionFollowUpList, [
  "Retornos agendados",
  "Atrasados",
  "Hoje",
  "Amanha",
  "Proximos sete dias",
  "CollectionFollowUpCard",
  "onOpenDetail",
  "groupFollowUps",
  "sameRange",
]);

includesAll(collectionFollowUpCard, [
  "CollectionPriorityBadge",
  "CollectionStatusBadge",
  "formatOutstanding",
  "collectionActionTypeLabel",
  "Abrir detalhe",
  "onOpenDetail(caseItem.invoiceId)",
  "caseItem.nextFollowUpAt",
  "caseItem.daysOverdue",
]);

includesAll(panel, [
  "page",
  "limit: 10",
]);

assert.equal(
  collectionList.includes("overflow-x-auto"),
  false,
  "The modernized collections queue must not use horizontal table scrolling",
);
assert.equal(
  collectionList.includes("min-w-["),
  false,
  "The modernized collections queue must not use fixed min-width table layouts",
);
for (const source of [collectionFollowUpList, collectionFollowUpCard]) {
  assert.equal(
    source.includes("overflow-x-auto"),
    false,
    "The modernized follow-up panel must not use horizontal table scrolling",
  );
  assert.equal(
    source.includes("min-w-["),
    false,
    "The modernized follow-up panel must not use fixed min-width table layouts",
  );
}

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
for (const source of [
  collectionDetails,
  collectionBankSlipSection,
  collectionHistory,
  collectionHistoryItem,
  collectionActionForm,
  collectionActionFields,
  collectionActionTypeSelector,
  collectionActionFeedback,
  collectionActionDisplayUtils,
  collectionFollowUpList,
  collectionFollowUpCard,
]) {
  for (const forbidden of [
    "api.syncInvoiceBankSlip",
    "api.issueInvoiceBankSlip",
    "api.cancelInvoiceBankSlip",
    "api.cancelInvoice",
    "api.syncPaidBankSlipsDay",
    "Consultar Sicredi",
    "Emitir boleto",
    "Cancelar boleto",
    "Dar baixa",
    "method: \"POST\"",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `The collections detail components must not use ${forbidden}`,
    );
  }
}

console.log("Finance collections panel OK");
