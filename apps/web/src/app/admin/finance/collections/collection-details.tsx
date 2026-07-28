import type {
  BankSlipRecord,
  CollectionAction,
  CollectionCaseDetail,
} from "../../../../lib/api";
import { CollectionActionForm } from "./collection-action-form";
import { CollectionBankSlipSection } from "./collection-bank-slip-section";
import { CollectionDetailsHeader } from "./collection-details-header";
import { CollectionFinancialSummary } from "./collection-financial-summary";
import { CollectionFollowUpSection } from "./collection-follow-up-section";
import { CollectionHistory } from "./collection-history";
import { CollectionPromiseSection } from "./collection-promise-section";

export function CollectionDetails({
  actions,
  bankSlip,
  busy,
  canRegisterActions,
  caseDetail,
  onActionCreated,
  onCopyLine,
  onDownloadPdf,
  onHideActionForm,
  onShowActionForm,
  showActionForm,
}: {
  actions: CollectionAction[];
  bankSlip: BankSlipRecord | null | undefined;
  busy: boolean;
  canRegisterActions: boolean;
  caseDetail: CollectionCaseDetail;
  onActionCreated: () => Promise<void> | void;
  onCopyLine: () => void;
  onDownloadPdf: () => void;
  onHideActionForm: () => void;
  onShowActionForm: () => void;
  showActionForm: boolean;
}) {
  const closedCase =
    caseDetail.invoiceStatus === "PAID" || caseDetail.invoiceStatus === "CANCELLED";

  return (
    <div className="grid gap-4">
      <CollectionDetailsHeader caseDetail={caseDetail} />
      <CollectionFinancialSummary bankSlip={bankSlip} caseDetail={caseDetail} />
      <div className="grid gap-4 xl:grid-cols-2">
        <CollectionPromiseSection actions={actions} caseDetail={caseDetail} />
        <CollectionFollowUpSection actions={actions} caseDetail={caseDetail} />
      </div>
      <CollectionBankSlipSection
        bankSlip={bankSlip}
        busy={busy}
        caseDetail={caseDetail}
        onCopyLine={onCopyLine}
        onDownloadPdf={onDownloadPdf}
      />
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">
              Acoes de cobranca
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Registros manuais seguem o formulario existente.
            </p>
          </div>
          <button
            className="w-fit rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={!canRegisterActions || closedCase}
            onClick={onShowActionForm}
            type="button"
          >
            Registrar acao
          </button>
        </div>
        {closedCase ? (
          <p className="mt-3 text-sm text-slate-500">
            Faturas pagas ou canceladas nao aceitam novas acoes, mas o historico
            permanece disponivel.
          </p>
        ) : null}
        {showActionForm ? (
          <div className="mt-4">
            <CollectionActionForm
              caseDetail={caseDetail}
              onCancel={onHideActionForm}
              onCreated={onActionCreated}
            />
          </div>
        ) : null}
      </section>
      <CollectionHistory actions={actions} />
    </div>
  );
}
