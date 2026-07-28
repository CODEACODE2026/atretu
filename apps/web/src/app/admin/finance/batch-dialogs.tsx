import { AlertTriangle, CheckCircle2, RotateCcw, Send, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type BankSlipIssueBatch,
  type BankSlipIssueBatchPreview,
} from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import {
  batchDisplayId,
  batchFailureCount,
  batchPreviewAffectedCount,
  batchSourceLabel,
} from "./batch-display-utils";
import { BatchStatusBadge } from "./batch-status-badge";

export type BatchDialogState =
  | {
      count: number;
      type: "create-manual";
    }
  | {
      preview: BankSlipIssueBatchPreview;
      type: "create-institution";
    }
  | {
      batch: BankSlipIssueBatch;
      type: "cancel";
    }
  | {
      batch: BankSlipIssueBatch;
      type: "retry";
    }
  | {
      message: string;
      title: string;
      tone: "danger" | "success" | "warning";
      type: "result";
    };

export function BatchDialog({
  dialog,
  onClose,
  onConfirmCancel,
  onConfirmCreateInstitution,
  onConfirmCreateManual,
  onConfirmRetry,
  saving,
}: {
  dialog: BatchDialogState | null;
  onClose: () => void;
  onConfirmCancel: (reason: string) => void;
  onConfirmCreateInstitution: () => void;
  onConfirmCreateManual: () => void;
  onConfirmRetry: (reason: string) => void;
  saving: boolean;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    setReason("");
  }, [dialog]);

  if (!dialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="batch-dialog-title">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-normal text-slate-950" id="batch-dialog-title">
              {dialogTitle(dialog)}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{dialogDescription(dialog)}</p>
          </div>
          <button className={cx(adminTheme.iconButton, "h-9 w-9 shrink-0")} disabled={saving} onClick={onClose} type="button" aria-label="Fechar diálogo">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          {dialog.type === "create-manual" ? <CreateManualBody count={dialog.count} /> : null}
          {dialog.type === "create-institution" ? <CreateInstitutionBody preview={dialog.preview} /> : null}
          {dialog.type === "cancel" ? (
            <ReasonBody
              batch={dialog.batch}
              label="Motivo do cancelamento"
              onReasonChange={setReason}
              reason={reason}
              warning="Somente itens ainda aguardando serão cancelados. Itens já processados preservam o estado retornado pelo contrato atual."
            />
          ) : null}
          {dialog.type === "retry" ? (
            <ReasonBody
              batch={dialog.batch}
              label="Motivo do retry"
              onReasonChange={setReason}
              reason={reason}
              warning="O retry seguro reenfileira apenas itens FAILED. Itens UNKNOWN permanecem bloqueados para evitar emissão duplicada."
            />
          ) : null}
          {dialog.type === "result" ? <ResultBody message={dialog.message} tone={dialog.tone} /> : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className={adminTheme.secondaryButton} disabled={saving} onClick={onClose} type="button">
            {dialog.type === "result" ? "Fechar" : "Cancelar"}
          </button>
          {dialog.type === "create-manual" ? (
            <button className={adminTheme.primaryButton} disabled={saving} onClick={onConfirmCreateManual} type="button">
              <Send aria-hidden="true" className="h-4 w-4" />
              {saving ? "Criando lote..." : "Confirmar emissão"}
            </button>
          ) : null}
          {dialog.type === "create-institution" ? (
            <button className={adminTheme.primaryButton} disabled={saving} onClick={onConfirmCreateInstitution} type="button">
              <Send aria-hidden="true" className="h-4 w-4" />
              {saving ? "Criando lote..." : "Gerar faturas e emitir"}
            </button>
          ) : null}
          {dialog.type === "cancel" ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-700 bg-amber-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              disabled={saving}
              onClick={() => onConfirmCancel(reason)}
              type="button"
            >
              <XCircle aria-hidden="true" className="h-4 w-4" />
              {saving ? "Cancelando..." : "Cancelar lote"}
            </button>
          ) : null}
          {dialog.type === "retry" ? (
            <button className={adminTheme.primaryButton} disabled={saving || dialog.batch.failedItems === 0} onClick={() => onConfirmRetry(reason)} type="button">
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              {saving ? "Reenfileirando..." : "Confirmar retry"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CreateManualBody({ count }: { count: number }) {
  return (
    <div className={cx(adminTheme.softPanel, "grid gap-3 p-4 text-sm text-slate-700")}>
      <Metric label="Faturas selecionadas" value={String(count)} />
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 leading-6 text-amber-800">
        A emissão seguirá o contrato atual do Sicredi para cada fatura elegível. O botão fica bloqueado durante o envio para evitar duplicidade.
      </p>
    </div>
  );
}

function CreateInstitutionBody({ preview }: { preview: BankSlipIssueBatchPreview }) {
  return (
    <div className={cx(adminTheme.softPanel, "grid gap-3 p-4 text-sm text-slate-700 md:grid-cols-2")}>
      <Metric label="Instituição" value={preview.institutionName} />
      <Metric label="Quantidade afetada" value={String(batchPreviewAffectedCount(preview))} />
      <Metric label="Faturas a criar" value={String(preview.totalWillCreateInvoices)} />
      <Metric label="Valor previsto" value={preview.eligibleAmountFormatted} />
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 leading-6 text-amber-800 md:col-span-2">
        Apenas alunos elegíveis da prévia serão enviados. Bloqueios, boletos ativos e faturas pagas continuam preservados.
      </p>
    </div>
  );
}

function ReasonBody({
  batch,
  label,
  onReasonChange,
  reason,
  warning,
}: {
  batch: BankSlipIssueBatch;
  label: string;
  onReasonChange: (value: string) => void;
  reason: string;
  warning: string;
}) {
  return (
    <div className="grid gap-4">
      <div className={cx(adminTheme.softPanel, "grid gap-3 p-4 text-sm md:grid-cols-2")}>
        <Metric label="Lote" value={batchDisplayId(batch)} />
        <Metric label="Origem" value={batchSourceLabel(batch.source)} />
        <Metric label="Falhas seguras" value={String(batch.failedItems)} />
        <Metric label="Situações incertas" value={String(batch.unknownItems)} />
        <Metric label="Total afetado" value={String(batch.failedItems || batch.totalItems)} />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-slate-500">Situação</span>
          <BatchStatusBadge batch={batch} />
        </div>
      </div>
      {batch.failedItems === 0 && batch.unknownItems > 0 ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm leading-6 text-orange-800">
          Este lote possui itens incertos, mas nenhum item FAILED. Não há retry seguro disponível.
        </p>
      ) : null}
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
        {warning}
      </p>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        {label}
        <textarea
          className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1F6F5F] focus:ring-4 focus:ring-[#1F6F5F]/15"
          maxLength={500}
          onChange={(event) => onReasonChange(event.target.value)}
          value={reason}
        />
      </label>
    </div>
  );
}

function ResultBody({
  message,
  tone,
}: {
  message: string;
  tone: "danger" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800";
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={cx("rounded-xl border p-4 text-sm leading-6", toneClass)}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <p>{message}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0">
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="block truncate font-semibold text-slate-950">{value}</span>
    </p>
  );
}

function dialogTitle(dialog: BatchDialogState) {
  if (dialog.type === "create-manual") {
    return "Confirmar emissão manual em lote";
  }
  if (dialog.type === "create-institution") {
    return "Confirmar lote institucional";
  }
  if (dialog.type === "cancel") {
    return "Cancelar lote de emissão";
  }
  if (dialog.type === "retry") {
    return "Confirmar retry seguro";
  }
  return dialog.title;
}

function dialogDescription(dialog: BatchDialogState) {
  if (dialog.type === "create-manual") {
    return "Revise a quantidade antes de enviar as faturas selecionadas para emissão.";
  }
  if (dialog.type === "create-institution") {
    return "Revise a prévia institucional antes de criar faturas ausentes e emitir os boletos elegíveis.";
  }
  if (dialog.type === "cancel") {
    return "O cancelamento atua somente sobre o lote atual e preserva os itens já finalizados.";
  }
  if (dialog.type === "retry") {
    return "Somente itens FAILED serão reenfileirados. UNKNOWN não participa do retry seguro.";
  }
  return "";
}
