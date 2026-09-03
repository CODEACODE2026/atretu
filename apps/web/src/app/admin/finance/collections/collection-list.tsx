import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { CollectionCase } from "../../../../lib/api";
import { adminTheme, cx } from "../../admin-theme";
import { CollectionCard } from "./collection-card";

export function CollectionList({
  cases,
  loading,
  onOpenDetail,
  page,
  setPage,
  total,
  totalPages,
}: {
  cases: CollectionCase[];
  loading: boolean;
  onOpenDetail: (invoiceId: string) => void;
  page: number;
  setPage: (page: number) => void;
  total: number;
  totalPages: number;
}) {
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Fila de cobranca
          </h3>
          <p className="text-xs text-slate-500">
            {total} caso(s) vencido(s) conforme filtros atuais
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
              key={index}
            />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
          <Inbox aria-hidden className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Nenhuma fatura vencida encontrada
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ajuste os filtros ou atualize a fila para consultar novos casos.
          </p>
        </div>
      ) : (
        <div className="mt-4 min-w-0 rounded-lg border border-slate-200">
          <div className="hidden grid-cols-[minmax(9rem,1.5fr)_minmax(8rem,1fr)_6.5rem_6.5rem_5.5rem_5.75rem_minmax(8rem,1.15fr)_6.75rem_5.75rem_5rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500 xl:grid">
            <span>Acadêmico</span>
            <span>Instituição</span>
            <span>Pendente</span>
            <span>Vencimento</span>
            <span>Atraso</span>
            <span>Prioridade</span>
            <span>Status</span>
            <span>Próximo retorno</span>
            <span>Boleto</span>
            <span>Ação</span>
          </div>
          {cases.map((caseItem) => (
            <CollectionCard
              caseItem={caseItem}
              key={caseItem.invoiceId}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}

      <Pagination page={page} setPage={setPage} totalPages={totalPages} />
    </section>
  );
}

function Pagination({
  page,
  setPage,
  totalPages,
}: {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      <button
        className={adminTheme.secondaryButton}
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        type="button"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
        Anterior
      </button>
      <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        Pagina {page} de {totalPages}
      </span>
      <button
        className={adminTheme.secondaryButton}
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
        type="button"
      >
        Proxima
        <ChevronRight aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
