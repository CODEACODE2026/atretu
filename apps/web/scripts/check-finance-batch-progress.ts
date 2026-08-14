import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { BankSlipIssueBatch } from "../src/lib/api";
import {
  batchProgress,
  batchStatusLabel,
  formatBatchUpdatedAgo,
} from "../src/app/admin/finance/batch-display-utils";

function makeBatch(
  overrides: Partial<BankSlipIssueBatch>,
): BankSlipIssueBatch {
  return {
    id: "12345678-1234-1234-1234-123456789abc",
    source: "INSTITUTION",
    institutionId: "institution-1",
    institution: { id: "institution-1", name: "Instituicao QA" },
    competence: "2026-08",
    dueDate: "2026-08-20",
    shiftId: null,
    shift: null,
    status: "QUEUED",
    requestedByUserId: "user-1",
    cancelledByUserId: null,
    cancelReason: null,
    totalStudents: 10,
    totalInvoices: 10,
    totalEligible: 10,
    unitAmountCents: 12345,
    totalValueCents: 123450,
    totalItems: 10,
    processedItems: 0,
    successItems: 0,
    progressPercent: 0,
    queuedItems: 10,
    processingItems: 0,
    issuedItems: 0,
    skippedItems: 0,
    failedItems: 0,
    unknownItems: 0,
    cancelledItems: 0,
    startedAt: null,
    finishedAt: null,
    cancelledAt: null,
    metadata: null,
    createdAt: "2026-08-13T20:00:00.000Z",
    updatedAt: "2026-08-13T20:00:00.000Z",
    ...overrides,
  };
}

assert.deepEqual(
  batchProgress(makeBatch({ status: "QUEUED" })),
  { percent: 0, processedItems: 0, totalItems: 10 },
);

assert.deepEqual(
  batchProgress(makeBatch({ issuedItems: 2, processingItems: 1, queuedItems: 7, status: "PROCESSING" })),
  { percent: 20, processedItems: 2, totalItems: 10 },
);

assert.deepEqual(
  batchProgress(makeBatch({ issuedItems: 42, totalItems: 100, queuedItems: 58, status: "PROCESSING" })),
  { percent: 42, processedItems: 42, totalItems: 100 },
);

assert.deepEqual(
  batchProgress(makeBatch({ failedItems: 2, issuedItems: 8, queuedItems: 0, status: "COMPLETED_WITH_ERRORS" })),
  { percent: 100, processedItems: 10, totalItems: 10 },
);

assert.deepEqual(
  batchProgress(makeBatch({ issuedItems: 10, queuedItems: 0, status: "COMPLETED" })),
  { percent: 100, processedItems: 10, totalItems: 10 },
);

assert.deepEqual(
  batchProgress(makeBatch({ cancelledItems: 6, issuedItems: 4, queuedItems: 0, status: "CANCELLED" })),
  { percent: 40, processedItems: 4, totalItems: 10 },
  "Cancelled queued items must not count as processed progress",
);

assert.deepEqual(
  batchProgress(makeBatch({ issuedItems: 4, skippedItems: 2, failedItems: 1, unknownItems: 1, queuedItems: 2, status: "PROCESSING" })),
  { percent: 80, processedItems: 8, totalItems: 10 },
);

assert.deepEqual(
  batchProgress(makeBatch({ issuedItems: 417, failedItems: 3, totalItems: 1000, queuedItems: 580, status: "PROCESSING" })),
  { percent: 42, processedItems: 420, totalItems: 1000 },
);

assert.equal(batchStatusLabel(makeBatch({ status: "QUEUED" })), "Aguardando");
assert.equal(batchStatusLabel(makeBatch({ status: "DRAFT" })), "Aguardando");
assert.equal(batchStatusLabel(makeBatch({ status: "PROCESSING" })), "Processando");
assert.equal(batchStatusLabel(makeBatch({ status: "COMPLETED" })), "Concluído");
assert.equal(
  batchStatusLabel(makeBatch({ status: "COMPLETED_WITH_ERRORS" })),
  "Concluído com falhas",
);
assert.equal(batchStatusLabel(makeBatch({ status: "CANCELLED" })), "Cancelado");
assert.equal(batchStatusLabel(makeBatch({ status: "FAILED" })), "Falhou");

assert.equal(
  formatBatchUpdatedAgo("2026-08-13T20:00:20.000Z", Date.parse("2026-08-13T20:00:40.000Z")),
  "Atualizado há poucos segundos",
);
assert.equal(
  formatBatchUpdatedAgo("2026-08-13T19:58:00.000Z", Date.parse("2026-08-13T20:00:40.000Z")),
  "Atualizado há 2min",
);

const batchCardSource = readFileSync(
  new URL("../src/app/admin/finance/batch-card.tsx", import.meta.url),
  "utf8",
);

assert.match(
  batchCardSource,
  /processedItems \+ batch\.failedItems \+ batch\.skippedItems \+ batch\.unknownItems|batchProgress\(batch\)/,
  "Batch card must use processed progress instead of issued-only progress",
);

assert.match(
  batchCardSource,
  /processados • \{progress\.percent\}%/,
  "Batch card must show 'X de Y processados • Z%'",
);

assert.match(
  batchCardSource,
  /batch\.status === "PROCESSING"/,
  "Processing feedback must be tied to the real PROCESSING status",
);

assert.match(
  batchCardSource,
  /Processando\.\.\./,
  "Processing batches must show an active processing label",
);

assert.match(
  batchCardSource,
  /Loader2[\s\S]*animate-spin[\s\S]*motion-reduce:animate-none/,
  "Processing spinner must respect reduced motion",
);

assert.match(
  batchCardSource,
  /batch-progress-fill-processing/,
  "Processing batches must use the shimmer progress class",
);

assert.match(
  batchCardSource,
  /style=\{\{ width: `\$\{percent\}%` \}\}/,
  "Progress bar width must keep using the real percent only",
);

assert.match(
  batchCardSource,
  /Metric label="Emitidos"[\s\S]*Metric label="Falhas"[\s\S]*Metric label="Ignorados"[\s\S]*Metric label="Desconhecidos"/,
  "Batch card must keep compact issued, failed, skipped, and unknown metrics",
);

assert.match(
  batchCardSource,
  /Total: \{batch\.totalItems\} itens[\s\S]*Duração:[\s\S]*Criado em:[\s\S]*Atualizado:/,
  "Batch metadata must stay secondary below the progress panel",
);

assert.match(
  batchCardSource,
  /flex flex-wrap items-center gap-2/,
  "Batch actions must wrap on narrow screens",
);

assert.match(
  batchCardSource,
  /min-w-0 overflow-hidden/,
  "Batch card must guard against horizontal overflow",
);

assert.match(
  batchCardSource,
  /sm:grid-cols-2 lg:grid-cols-4/,
  "Batch metrics must wrap responsively for mobile and desktop",
);

const globalsSource = readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

assert.match(
  globalsSource,
  /\.batch-progress-fill-processing::after[\s\S]*batch-progress-shimmer/,
  "Processing progress must use a subtle shimmer pseudo-element",
);

assert.match(
  globalsSource,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/,
  "Processing shimmer must respect reduced motion",
);

console.log("Finance batch progress guard OK");
