import { AlertTriangle, CheckCircle2, Clock3, FileWarning, Info, RotateCcw } from "lucide-react";
import { type ReactNode } from "react";
import {
  type BankSlipIssueBatch,
  type BankSlipIssueBatchItem,
} from "../../../lib/api";
import { formatDateTime } from "../../../lib/formatters/date";
import { adminTheme, cx } from "../admin-theme";
import {
  batchFailureCount,
  batchSourceLabel,
  formatBatchDuration,
  batchElapsedMs,
} from "./batch-display-utils";
import { BatchItemStatusBadge } from "./batch-status-badge";

export function BatchDetails({
  batch,
  items,
}: {
  batch: BankSlipIssueBatch;
  items: BankSlipIssueBatchItem[];
}) {
  const issued = items.filter((item) => item.status === "ISSUED");
  const failed = items.filter((item) => item.status === "FAILED");
  const skipped = items.filter((item) => item.status === "SKIPPED");
  const unknown = items.filter((item) => item.status === "UNKNOWN");
  const pending = items.filter((item) => item.status === "QUEUED" || item.status === "PROCESSING");
  const providerMessages = items.filter((item) => item.lastErrorMessage || item.skipReason);

  return (
    <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4">
      <section className={cx(adminTheme.softPanel, "grid gap-3 p-4 md:grid-cols-3")}>
        <DetailMetric label="Origem" value={batchSourceLabel(batch.source)} />
        <DetailMetric label="Processados" value={`${batch.processedItems}/${batch.totalItems}`} />
        <DetailMetric label="Duração" value={formatBatchDuration(batchElapsedMs(batch))} />
        <DetailMetric label="Falhas totais" value={String(batchFailureCount(batch))} />
        <DetailMetric label="Criado em" value={formatDateTime(batch.createdAt)} />
        <DetailMetric label="Última atualização" value={formatDateTime(batch.updatedAt)} />
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        <BatchItemGroup
          emptyText="Nenhum boleto emitido neste lote."
          icon={<CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
          items={issued}
          title="Boletos emitidos"
        />
        <BatchItemGroup
          emptyText="Nenhuma falha segura para retry."
          icon={<AlertTriangle aria-hidden="true" className="h-4 w-4" />}
          items={failed}
          title="Falhas"
        />
        <BatchItemGroup
          emptyText="Nenhum item ignorado."
          icon={<FileWarning aria-hidden="true" className="h-4 w-4" />}
          items={skipped}
          title="Ignorados"
        />
        <BatchItemGroup
          emptyText="Nenhum item incerto."
          icon={<Info aria-hidden="true" className="h-4 w-4" />}
          items={unknown}
          title="Desconhecidos"
        />
        <BatchItemGroup
          emptyText="Nenhum item aguardando processamento."
          icon={<Clock3 aria-hidden="true" className="h-4 w-4" />}
          items={pending}
          title="Histórico operacional"
        />
        <BatchProviderMessages items={providerMessages} />
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 text-sm">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="block truncate font-semibold text-slate-950">{value}</span>
    </p>
  );
}

function BatchItemGroup({
  emptyText,
  icon,
  items,
  title,
}: {
  emptyText: string;
  icon: ReactNode;
  items: BankSlipIssueBatchItem[];
  title: string;
}) {
  return (
    <section className={cx(adminTheme.softPanel, "min-w-0 p-4")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          {icon}
          {title}
        </h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.slice(0, 8).map((item) => (
            <BatchItemRow item={item} key={item.id} />
          ))}
          {items.length > 8 ? (
            <p className="text-xs font-medium text-slate-500">
              Mais {items.length - 8} item(ns) neste grupo.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function BatchProviderMessages({ items }: { items: BankSlipIssueBatchItem[] }) {
  return (
    <section className={cx(adminTheme.softPanel, "min-w-0 p-4")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Mensagens do provedor
        </h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nenhuma mensagem de erro ou bloqueio registrada.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.slice(0, 8).map((item) => (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm" key={item.id}>
              <div className="flex flex-wrap items-center gap-2">
                <BatchItemStatusBadge status={item.status} />
                <span className="font-semibold text-slate-950">
                  {item.studentName ?? item.invoiceId?.slice(0, 8) ?? "Item do lote"}
                </span>
              </div>
              {item.lastErrorCode ? (
                <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{item.lastErrorCode}</p>
              ) : null}
              <p className="mt-1 text-slate-700">{item.skipReason ?? item.lastErrorMessage}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BatchItemRow({ item }: { item: BankSlipIssueBatchItem }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <BatchItemStatusBadge status={item.status} />
        <span className="min-w-0 truncate font-semibold text-slate-950">
          {item.studentName ?? item.invoiceId?.slice(0, 8) ?? "Item do lote"}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <span>Tentativas: {item.attempts}</span>
        <span>Atualizado: {formatDateTime(item.updatedAt)}</span>
        <span>Fatura: {item.invoiceId ? item.invoiceId.slice(0, 8) : "Sem fatura"}</span>
        <span>Boleto: {item.nossoNumero ?? "Não informado"}</span>
      </div>
    </div>
  );
}
