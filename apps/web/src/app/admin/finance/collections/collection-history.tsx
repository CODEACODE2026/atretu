import type { CollectionAction } from "../../../../lib/api";
import { CollectionHistoryItem } from "./collection-history-item";
import { SectionTitle } from "./collection-financial-summary";

export function CollectionHistory({ actions }: { actions: CollectionAction[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle
        subtitle="Linha do tempo somente leitura das interacoes registradas."
        title="Historico de acoes"
      />
      {actions.length === 0 ? (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Nenhuma acao registrada.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {actions.map((action) => (
            <CollectionHistoryItem action={action} key={action.id} />
          ))}
        </div>
      )}
    </section>
  );
}
