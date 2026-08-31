import {
  type BankSlipIssueBatch,
  type BankSlipIssueBatchItem,
} from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { BatchCard } from "./batch-card";

export function BatchList({
  batches,
  busyBatchId,
  canCancelBatch = true,
  canDownloadBatch = true,
  canRetryBatch,
  emptyText = "Nenhum lote encontrado.",
  expandedBatchId,
  itemsByBatchId,
  loading,
  loadingItemsBatchId,
  onCancel,
  onDownload,
  onRefresh,
  onRetry,
  onToggle,
  title = "Lotes de emissão",
}: {
  batches: BankSlipIssueBatch[];
  busyBatchId: string;
  canCancelBatch?: boolean;
  canDownloadBatch?: boolean;
  canRetryBatch: boolean;
  emptyText?: string;
  expandedBatchId: string;
  itemsByBatchId: Record<string, BankSlipIssueBatchItem[] | undefined>;
  loading: boolean;
  loadingItemsBatchId: string;
  onCancel: (batch: BankSlipIssueBatch) => void;
  onDownload: (batch: BankSlipIssueBatch) => void;
  onRefresh: (batch: BankSlipIssueBatch) => void;
  onRetry: (batch: BankSlipIssueBatch) => void;
  onToggle: (batch: BankSlipIssueBatch) => void;
  title?: string;
}) {
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")} aria-labelledby="batch-list-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cx(adminTheme.titleText, "text-base")} id="batch-list-title">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe emissão, falhas, retry seguro e downloads sem sair do Financeiro.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Carregando lotes...
        </p>
      ) : batches.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 grid min-w-0 gap-3">
          {batches.map((batch) => (
            <BatchCard
              batch={batch}
              busy={busyBatchId === batch.id}
              canCancelBatch={canCancelBatch}
              canDownloadBatch={canDownloadBatch}
              canRetryBatch={canRetryBatch}
              expanded={expandedBatchId === batch.id}
              items={itemsByBatchId[batch.id] ?? []}
              key={batch.id}
              loadingItems={loadingItemsBatchId === batch.id}
              onCancel={() => onCancel(batch)}
              onDownload={() => onDownload(batch)}
              onRefresh={() => onRefresh(batch)}
              onRetry={() => onRetry(batch)}
              onToggle={() => onToggle(batch)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
