import { Copy, Download } from "lucide-react";
import type { BankSlipRecord, CollectionCaseDetail } from "../../../../lib/api";
import { formatCollectionDateTime } from "./collection-display-utils";
import { Info, SectionTitle } from "./collection-financial-summary";

export function CollectionBankSlipSection({
  bankSlip,
  busy,
  caseDetail,
  onCopyLine,
  onDownloadPdf,
}: {
  bankSlip: BankSlipRecord | null | undefined;
  busy: boolean;
  caseDetail: CollectionCaseDetail;
  onCopyLine: () => void;
  onDownloadPdf: () => void;
}) {
  const summary = caseDetail.bankSlip;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle
          subtitle="Dados do boleto vinculado a esta fatura."
          title="Boleto"
        />
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            disabled={!bankSlip?.linhaDigitavel || busy}
            onClick={onCopyLine}
            type="button"
          >
            <Copy className="h-4 w-4" />
            Copiar linha digitavel
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            disabled={!summary?.pdfStoredAt || busy}
            onClick={onDownloadPdf}
            type="button"
          >
            <Download className="h-4 w-4" />
            Baixar PDF
          </button>
        </div>
      </div>

      {!summary ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Fatura sem boleto.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Info label="Status" value={bankSlip?.status ?? summary.status} />
            <Info
              label="Nosso numero"
              value={
                bankSlip?.nossoNumero ??
                bankSlip?.nossoNumeroMasked ??
                summary.nossoNumeroMasked ??
                "Nao disponivel"
              }
            />
            <Info
              label="Linha digitavel"
              value={bankSlip?.linhaDigitavel ?? "Nao disponivel"}
            />
            <Info
              label="PDF arquivado"
              value={
                summary.pdfStoredAt
                  ? formatCollectionDateTime(summary.pdfStoredAt)
                  : "Nao"
              }
            />
          </div>
          {!summary.pdfStoredAt ? (
            <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              PDF ainda nao arquivado.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
