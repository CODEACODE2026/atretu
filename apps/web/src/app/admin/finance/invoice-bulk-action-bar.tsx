import { Send, XCircle } from "lucide-react";
import { adminTheme, cx } from "../admin-theme";

export function InvoiceBulkActionBar({
  disabled,
  onClear,
  onCreateBatch,
  onSelectEligible,
  selectedCount,
}: {
  disabled: boolean;
  onClear: () => void;
  onCreateBatch: () => void;
  onSelectEligible: () => void;
  selectedCount: number;
}) {
  if (selectedCount === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-600">
          Selecione faturas elegíveis para emitir boletos em lote.
        </p>
        <button className={cx(adminTheme.secondaryButton, "h-9")} disabled={disabled} onClick={onSelectEligible} type="button">
          Selecionar elegíveis
        </button>
      </div>
    );
  }

  return (
    <div className="sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1F6F5F]/25 bg-[#EEF7F4] px-4 py-3 shadow-sm">
      <p className="text-sm font-semibold text-[#0F2E2E]">
        {selectedCount} {selectedCount === 1 ? "fatura selecionada" : "faturas selecionadas"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button className={adminTheme.secondaryButton} disabled={disabled} onClick={onClear} type="button">
          <XCircle aria-hidden className="h-4 w-4" />
          Limpar seleção
        </button>
        <button className={adminTheme.primaryButton} disabled={disabled} onClick={onCreateBatch} type="button">
          <Send aria-hidden className="h-4 w-4" />
          Emitir selecionadas
        </button>
      </div>
    </div>
  );
}
