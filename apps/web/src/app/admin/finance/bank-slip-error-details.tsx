import { AlertTriangle } from "lucide-react";
import { type BankSlipStatus } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import {
  bankSlipDisplayNumber,
  bankSlipPresentation,
  isFullBankSlipRecord,
  type BankSlipListRecord,
} from "./finance-display-utils";
import { BankSlipStatusBadge } from "./invoice-status-badge";

export function BankSlipErrorDetails({
  bankSlip,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
}) {
  if (!bankSlip) {
    return (
      <div className={cx(adminTheme.softPanel, "p-4 text-sm text-slate-600")}>
        Esta fatura ainda não possui boleto para detalhar.
      </div>
    );
  }

  const presentation = bankSlipPresentation(bankSlip);
  const full = isFullBankSlipRecord(bankSlip) ? bankSlip : null;
  const operationalMessage = statusGuidance(bankSlip.status);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">{presentation.label}</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">{operationalMessage}</p>
          </div>
        </div>
        <BankSlipStatusBadge bankSlip={bankSlip} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ErrorLine label="Nosso número" value={bankSlipDisplayNumber(bankSlip)} />
        <ErrorLine label="Código do provedor" value={full?.providerErrorCode ?? "Não informado"} />
        <ErrorLine label="Situação bancária" value={full?.providerStatus ?? "Não informada"} />
        <ErrorLine label="Última mensagem" value={full?.providerErrorMessage ?? "Sem mensagem detalhada do provedor."} />
      </div>
    </div>
  );
}

function ErrorLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="mt-1 block break-words font-medium text-slate-950">{value}</span>
    </p>
  );
}

function statusGuidance(status: BankSlipStatus) {
  if (status === "UNKNOWN") {
    return "O sistema não conseguiu confirmar a situação do boleto no Sicredi. Consulte novamente antes de tentar qualquer nova ação.";
  }
  if (status === "ISSUE_FAILED") {
    return "A emissão não foi concluída. Confira a mensagem do provedor antes de repetir qualquer tentativa permitida.";
  }
  if (status === "CANCELLATION_FAILED") {
    return "A solicitação de baixa encontrou erro no provedor. Confira a mensagem bancária antes de uma nova tentativa.";
  }
  return "Confira os detalhes técnicos preservados abaixo.";
}
