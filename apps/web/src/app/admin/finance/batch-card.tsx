import { ChevronDown, ChevronUp, Download, Loader2, RefreshCw, RotateCcw, XCircle } from "lucide-react";
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
  batchProgress,
  batchSourceLabel,
  batchStatusLabel,
  batchVisualStatus,
  formatBatchUpdatedAgo,
  formatBatchDuration,
  isBatchRunning,
} from "./batch-display-utils";
import { BatchDetails } from "./batch-details";
import { BatchStatusBadge } from "./batch-status-badge";

export function BatchCard({
  batch,
  busy,
  canCancelBatch,
  canDownloadBatch,
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
  canCancelBatch: boolean;
  canDownloadBatch: boolean;
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
  const progress = batchProgress(batch);
  const processing = batch.status === "PROCESSING";
  const updatedAgo = formatBatchUpdatedAgo(batch.updatedAt);

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
          {canDownloadBatch ? (
            <button className={adminTheme.secondaryButton} disabled={busy} onClick={onDownload} type="button">
              <Download aria-hidden="true" className="h-4 w-4" />
              ZIP
            </button>
          ) : null}
          {running && canCancelBatch ? (
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

      <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Progresso do lote
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-950">
              {progress.processedItems} de {progress.totalItems} processados • {progress.percent}%
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500 sm:items-end">
            <p className="inline-flex items-center gap-1.5 font-medium">
              {processing ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-[#1F6F5F] motion-reduce:animate-none" />
              ) : null}
              {processing ? "Processando..." : batchStatusLabel(batch)}
            </p>
            {updatedAgo ? <p>{updatedAgo}</p> : null}
          </div>
        </div>
        <BatchProgressBar batch={batch} percent={progress.percent} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Emitidos" tone="success" value={String(batch.issuedItems)} />
          <Metric label="Falhas" tone={batch.failedItems > 0 ? "danger" : "neutral"} value={String(batch.failedItems)} />
          <Metric label="Ignorados" tone={batch.skippedItems > 0 ? "warning" : "neutral"} value={String(batch.skippedItems)} />
          <Metric label="Desconhecidos" tone={batch.unknownItems > 0 ? "warning" : "neutral"} value={String(batch.unknownItems)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Total: {batch.totalItems} itens</span>
        <span>Duração: {formatBatchDuration(batchElapsedMs(batch))}</span>
        <span>Criado em: {formatDateTime(batch.createdAt)}</span>
        <span>Atualizado: {formatDateTime(batch.updatedAt)}</span>
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

function BatchProgressBar({
  batch,
  percent,
}: {
  batch: BankSlipIssueBatch;
  percent: number;
}) {
  const visualStatus = batchVisualStatus(batch);
  const processing = visualStatus === "processing";
  const fillClass =
    visualStatus === "cancelled"
      ? "bg-slate-500"
      : visualStatus === "failed"
        ? "bg-red-500"
        : visualStatus === "partial" || batch.failedItems > 0 || batch.unknownItems > 0
          ? "bg-amber-500"
          : visualStatus === "success"
            ? "bg-emerald-600"
            : "bg-[#1F6F5F]";

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
      <div
        className={cx(
          "h-full rounded-full transition-all",
          fillClass,
          processing && "batch-progress-fill batch-progress-fill-processing",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function Metric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "danger" | "neutral" | "success" | "warning";
  value: string;
}) {
  const toneClass = {
    danger: "text-red-700",
    neutral: "text-slate-950",
    success: "text-emerald-700",
    warning: "text-amber-700",
  }[tone];

  return (
    <p className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className={cx("block truncate font-semibold", toneClass)}>{value}</span>
    </p>
  );
}
