import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { BankSlipIssueBatch } from "../src/lib/api";
import {
  batchProgress,
  batchStatusLabel,
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
assert.equal(batchStatusLabel(makeBatch({ status: "PROCESSING" })), "Processando");
assert.equal(batchStatusLabel(makeBatch({ status: "COMPLETED" })), "Concluído");
assert.equal(
  batchStatusLabel(makeBatch({ status: "COMPLETED_WITH_ERRORS" })),
  "Concluído com falhas",
);
assert.equal(batchStatusLabel(makeBatch({ status: "CANCELLED" })), "Cancelado");

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

console.log("Finance batch progress guard OK");
