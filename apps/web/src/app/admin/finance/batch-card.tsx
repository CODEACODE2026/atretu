import { ChevronDown, ChevronUp, Download, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import {
  type BankSlipIssueBatch,
  type BankSlipIssueBatchItem,
} from "../../../lib/api";
import { formatDate, formatDateTime } from "../../../lib/formatters/date";
import { adminTheme, cx } from "../admin-theme";
import {
  batchDisplayId,
  batchElapsedMs,
  batchHasSafeRetry,
  batchSourceLabel,
  formatBatchDuration,
  isBatchRunning,
} from "./batch-display-utils";
import { BatchDetails } from "./batch-details";
import { BatchStatusBadge } from "./batch-status-badge";

export function BatchCard({
  batch,
  busy,
  canRetryBatch,
  expanded,
  items,
  loadingItems,
  onCancel,
  onDownload,
  onRefresh,
  onRetry,
  onToggle,
}: {
  batch: BankSlipIssueBatch;
  busy: boolean;
  canRetryBatch: boolean;
  expanded: boolean;
  items: BankSlipIssueBatchItem[];
  loadingItems: boolean;
  onCancel: () => void;
  onDownload: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  onToggle: () => void;
}) {
  const running = isBatchRunning(batch);
  const canRetry = canRetryBatch && batchHasSafeRetry(batch);

  return (
    <article className={cx(adminTheme.card, adminTheme.cardHover, "min-w-0 overflow-hidden p-4")}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BatchStatusBadge batch={batch} />
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {batchSourceLabel(batch.source)}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-bold text-slate-950">{batchDisplayId(batch)}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {batch.institution?.name ?? "Sem instituição"} · {formatDate(batch.dueDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onRefresh} type="button">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Atualizar
          </button>
          <button className={adminTheme.secondaryButton} disabled={busy} onClick={onDownload} type="button">
            <Download aria-hidden="true" className="h-4 w-4" />
            ZIP
          </button>
          {running ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-700 bg-white px-3 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              disabled={busy}
              onClick={onCancel}
              type="button"
            >
              <XCircle aria-hidden="true" className="h-4 w-4" />
              Cancelar
            </button>
          ) : null}
          {canRetry ? (
            <button className={adminTheme.primaryButton} disabled={busy} onClick={onRetry} type="button">
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Retry seguro
            </button>
          ) : null}
          <button className={adminTheme.secondaryButton} disabled={busy && !expanded} onClick={onToggle} type="button">
            {expanded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
            {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Metric label="Itens" value={String(batch.totalItems)} />
        <Metric label="Emitidos" value={String(batch.issuedItems)} />
        <Metric label="Falhas" value={String(batch.failedItems)} />
        <Metric label="Ignorados" value={String(batch.skippedItems)} />
        <Metric label="Desconhecidos" value={String(batch.unknownItems)} />
        <Metric label="Duração" value={formatBatchDuration(batchElapsedMs(batch))} />
        <Metric label="Criado em" value={formatDateTime(batch.createdAt)} />
        <Metric label="Atualizado" value={formatDateTime(batch.updatedAt)} />
      </div>

      {expanded ? (
        loadingItems ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Carregando detalhes do lote...
          </p>
        ) : (
          <BatchDetails batch={batch} items={items} />
        )
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="block truncate font-semibold text-slate-950">{value}</span>
    </p>
  );
}
