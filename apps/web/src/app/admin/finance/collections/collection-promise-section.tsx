import type { CollectionAction, CollectionCaseDetail } from "../../../../lib/api";
import {
  formatCents,
  formatCollectionDate,
  latestPromiseAction,
} from "./collection-display-utils";
import { Info, SectionTitle } from "./collection-financial-summary";

export function CollectionPromiseSection({
  actions,
  caseDetail,
}: {
  actions: CollectionAction[];
  caseDetail: CollectionCaseDetail;
}) {
  const promise = latestPromiseAction(actions);
  const state = caseDetail.brokenPromise
    ? "Promessa vencida"
    : caseDetail.operationalStatus === "PROMISE_ACTIVE"
      ? "Promessa ativa"
      : promise
        ? "Promessa registrada"
        : "Sem promessa";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle
        subtitle="Promessas registradas no historico do caso."
        title="Promessa"
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Info label="Situacao" value={state} />
        <Info
          label="Valor prometido"
          value={
            promise?.promisedAmountCents
              ? formatCents(promise.promisedAmountCents)
              : "Nao informado"
          }
        />
        <Info
          label="Data prometida"
          value={formatCollectionDate(promise?.promiseDueDate)}
        />
      </div>
    </section>
  );
}
