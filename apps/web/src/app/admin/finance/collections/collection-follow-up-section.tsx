import type { CollectionAction, CollectionCaseDetail } from "../../../../lib/api";
import {
  collectionFollowUpState,
  formatCollectionDateTime,
  latestFollowUpAction,
} from "./collection-display-utils";
import { Info, SectionTitle } from "./collection-financial-summary";

export function CollectionFollowUpSection({
  actions,
  caseDetail,
}: {
  actions: CollectionAction[];
  caseDetail: CollectionCaseDetail;
}) {
  const followUp = caseDetail.nextFollowUpAt ?? latestFollowUpAction(actions)?.nextFollowUpAt;
  const state = collectionFollowUpState(followUp);
  const label =
    state === "TODAY"
      ? "Retorno hoje"
      : state === "OVERDUE"
        ? "Retorno vencido"
        : state === "SCHEDULED"
          ? "Retorno agendado"
          : "Sem follow-up";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle
        subtitle="Proximo retorno indicado pela API e pelo historico."
        title="Follow-up"
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info label="Situacao" value={label} />
        <Info label="Proximo retorno" value={formatCollectionDateTime(followUp)} />
      </div>
    </section>
  );
}
