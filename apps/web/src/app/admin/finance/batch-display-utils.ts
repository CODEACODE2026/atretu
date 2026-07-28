import {
  type BankSlipIssueBatch,
  type BankSlipIssueBatchItem,
  type BankSlipIssueBatchPreview,
} from "../../../lib/api";

export type BatchVisualStatus =
  | "cancelled"
  | "failed"
  | "partial"
  | "processing"
  | "queued"
  | "success";

export type BatchSummary = {
  cancelledBatches: number;
  completedBatches: number;
  failedBatches: number;
  failedItems: number;
  issuedItems: number;
  partialBatches: number;
  processingBatches: number;
  queuedBatches: number;
  totalBatches: number;
  unknownItems: number;
};

export function batchVisualStatus(batch: BankSlipIssueBatch): BatchVisualStatus {
  if (batch.status === "CANCELLED") {
    return "cancelled";
  }
  if (batch.status === "FAILED") {
    return "failed";
  }
  if (batch.status === "COMPLETED_WITH_ERRORS") {
    return "partial";
  }
  if (batch.status === "PROCESSING") {
    return "processing";
  }
  if (batch.status === "COMPLETED") {
    return "success";
  }
  return "queued";
}

export function batchStatusLabel(batch: BankSlipIssueBatch) {
  const labels: Record<ReturnType<typeof batchVisualStatus>, string> = {
    cancelled: "Cancelado",
    failed: "Falhou",
    partial: "Parcial",
    processing: "Processando",
    queued: "Aguardando",
    success: "Concluído",
  };
  return labels[batchVisualStatus(batch)];
}

export function batchItemStatusLabel(status: BankSlipIssueBatchItem["status"]) {
  const labels: Record<BankSlipIssueBatchItem["status"], string> = {
    CANCELLED: "Cancelado",
    FAILED: "Falhou",
    ISSUED: "Emitido",
    PROCESSING: "Processando",
    QUEUED: "Aguardando",
    SKIPPED: "Ignorado",
    UNKNOWN: "Situação incerta",
  };
  return labels[status];
}

export function batchSourceLabel(source: BankSlipIssueBatch["source"]) {
  return source === "INSTITUTION" ? "Institucional" : "Manual";
}

export function isBatchRunning(batch: BankSlipIssueBatch) {
  return batch.status === "QUEUED" || batch.status === "PROCESSING";
}

export function batchDisplayId(batch: BankSlipIssueBatch) {
  return `Lote ${batch.id.slice(0, 8)}`;
}

export function batchElapsedMs(batch: BankSlipIssueBatch) {
  const startedAt = Date.parse(batch.startedAt ?? batch.createdAt);
  if (Number.isNaN(startedAt)) {
    return 0;
  }
  const endedAt = batch.finishedAt ? Date.parse(batch.finishedAt) : Date.now();
  return Number.isNaN(endedAt) || endedAt < startedAt ? 0 : endedAt - startedAt;
}

export function formatBatchDuration(valueMs: number) {
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;
}

export function batchHasSafeRetry(batch: BankSlipIssueBatch) {
  return batch.failedItems > 0;
}

export function batchFailureCount(batch: BankSlipIssueBatch) {
  return batch.failedItems + batch.unknownItems;
}

export function calculateBatchSummary(batches: BankSlipIssueBatch[]): BatchSummary {
  return batches.reduce<BatchSummary>(
    (summary, batch) => {
      summary.totalBatches += 1;
      summary.issuedItems += batch.issuedItems;
      summary.failedItems += batch.failedItems;
      summary.unknownItems += batch.unknownItems;
      if (batch.status === "PROCESSING") {
        summary.processingBatches += 1;
      } else if (batch.status === "QUEUED" || batch.status === "DRAFT") {
        summary.queuedBatches += 1;
      } else if (batch.status === "COMPLETED") {
        summary.completedBatches += 1;
      } else if (batch.status === "COMPLETED_WITH_ERRORS") {
        summary.partialBatches += 1;
      } else if (batch.status === "FAILED") {
        summary.failedBatches += 1;
      } else if (batch.status === "CANCELLED") {
        summary.cancelledBatches += 1;
      }
      return summary;
    },
    {
      cancelledBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      failedItems: 0,
      issuedItems: 0,
      partialBatches: 0,
      processingBatches: 0,
      queuedBatches: 0,
      totalBatches: 0,
      unknownItems: 0,
    },
  );
}

export function batchPreviewAffectedCount(preview: BankSlipIssueBatchPreview | null) {
  return preview?.totalEligible ?? 0;
}

export function filterBatches(batches: BankSlipIssueBatch[], search: string) {
  const query = normalizeBatchSearch(search);
  if (!query) {
    return batches;
  }
  return batches.filter((batch) =>
    [
      batchDisplayId(batch),
      batchSourceLabel(batch.source),
      batchStatusLabel(batch),
      batch.institution?.name ?? "",
      batch.shift?.name ?? "",
      batch.competence ?? "",
      batch.dueDate ?? "",
      batch.createdAt,
    ].some((value) => normalizeBatchSearch(value).includes(query)),
  );
}

function normalizeBatchSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
