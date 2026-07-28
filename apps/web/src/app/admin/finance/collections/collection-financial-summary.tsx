import type { BankSlipRecord, CollectionCaseDetail } from "../../../../lib/api";
import {
  collectionAgingBucketLabel,
  collectionOperationalStatusLabel,
} from "../../collection-formatters";
import {
  collectionBankSlipValue,
  collectionInvoiceStatusLabel,
  formatCents,
  formatCollectionDate,
  formatOutstanding,
} from "./collection-display-utils";

export function CollectionFinancialSummary({
  bankSlip,
  caseDetail,
}: {
  bankSlip: BankSlipRecord | null | undefined;
  caseDetail: CollectionCaseDetail;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle
        subtitle="Valores e estados derivados pela API."
        title="Resumo financeiro"
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Valor original" value={caseDetail.amountFormatted} />
        <Info
          label="Valor pago"
          value={formatCents(collectionBankSlipValue(bankSlip, caseDetail))}
        />
        <Info label="Valor pendente" value={formatOutstanding(caseDetail)} />
        <Info label="Vencimento" value={formatCollectionDate(caseDetail.dueDate)} />
        <Info
          label="Faixa de atraso"
          value={collectionAgingBucketLabel(caseDetail.agingBucket)}
        />
        <Info
          label="Status financeiro"
          value={collectionInvoiceStatusLabel(caseDetail.invoiceStatus)}
        />
        <Info
          label="Status operacional"
          value={collectionOperationalStatusLabel(caseDetail.operationalStatus)}
        />
        <Info
          label="Pagamento parcial"
          value={caseDetail.partialPaymentReview ? "Baixa em revisao" : "Sem revisao"}
        />
      </div>
      {caseDetail.brokenPromise ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Promessa vencida sinalizada pela regra operacional atual.
        </p>
      ) : null}
    </section>
  );
}

export function SectionTitle({
  subtitle,
  title,
}: {
  subtitle?: string;
  title: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-950">
        {value}
      </p>
    </div>
  );
}
