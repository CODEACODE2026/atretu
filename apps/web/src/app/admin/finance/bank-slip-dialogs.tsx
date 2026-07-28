import { AlertTriangle, CheckCircle2, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type InvoiceCancellationReason, type InvoiceRecord } from "../../../lib/api";
import { formatDate } from "../../../lib/formatters/date";
import { adminTheme, cx } from "../admin-theme";
import { type BankSlipListRecord } from "./finance-display-utils";
import { BankSlipErrorDetails } from "./bank-slip-error-details";

export type CancellationReasonOption = {
  label: string;
  value: InvoiceCancellationReason;
};

export type BankSlipDialogState =
  | {
      bankSlip: BankSlipListRecord | null | undefined;
      invoice: InvoiceRecord;
      type: "cancel";
    }
  | {
      bankSlip: BankSlipListRecord | null | undefined;
      invoice: InvoiceRecord;
      type: "error";
    }
  | {
      invoice: InvoiceRecord;
      type: "issue";
    }
  | {
      bankSlip: BankSlipListRecord | null | undefined;
      invoice: InvoiceRecord;
      type: "sync";
    }
  | {
      message: string;
      title: string;
      tone: "danger" | "success" | "warning";
      type: "result";
    };

export function BankSlipDialog({
  dialog,
  onClose,
  onConfirmCancel,
  onConfirmIssue,
  onConfirmSync,
  reasonOptions,
  saving,
}: {
  dialog: BankSlipDialogState | null;
  onClose: () => void;
  onConfirmCancel: (reason: InvoiceCancellationReason, note: string) => void;
  onConfirmIssue: () => void;
  onConfirmSync: () => void;
  reasonOptions: CancellationReasonOption[];
  saving: boolean;
}) {
  const [reason, setReason] = useState<InvoiceCancellationReason | "">("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setReason("");
    setNote("");
  }, [dialog]);

  if (!dialog) {
    return null;
  }

  const title = dialogTitle(dialog);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="bank-slip-dialog-title">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-normal text-slate-950" id="bank-slip-dialog-title">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{dialogDescription(dialog)}</p>
          </div>
          <button className={cx(adminTheme.iconButton, "h-9 w-9 shrink-0")} disabled={saving} onClick={onClose} type="button" aria-label="Fechar diálogo">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5">
          {dialog.type === "issue" ? <IssueDialogBody invoice={dialog.invoice} /> : null}
          {dialog.type === "sync" ? <SyncDialogBody invoice={dialog.invoice} /> : null}
          {dialog.type === "cancel" ? (
            <CancelDialogBody
              note={note}
              onNoteChange={setNote}
              onReasonChange={setReason}
              reason={reason}
              reasonOptions={reasonOptions}
            />
          ) : null}
          {dialog.type === "error" ? <BankSlipErrorDetails bankSlip={dialog.bankSlip} /> : null}
          {dialog.type === "result" ? <ResultDialogBody message={dialog.message} tone={dialog.tone} /> : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button className={adminTheme.secondaryButton} disabled={saving} onClick={onClose} type="button">
            {dialog.type === "result" || dialog.type === "error" ? "Fechar" : "Cancelar"}
          </button>
          {dialog.type === "issue" ? (
            <button className={adminTheme.primaryButton} disabled={saving} onClick={onConfirmIssue} type="button">
              <Send aria-hidden="true" className="h-4 w-4" />
              {saving ? "Processando..." : "Confirmar emissão"}
            </button>
          ) : null}
          {dialog.type === "sync" ? (
            <button className={adminTheme.primaryButton} disabled={saving} onClick={onConfirmSync} type="button">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {saving ? "Processando..." : "Confirmar consulta"}
            </button>
          ) : null}
          {dialog.type === "cancel" ? (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-700 bg-amber-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              disabled={saving || !reason}
              onClick={() => {
                if (reason) {
                  onConfirmCancel(reason, note);
                }
              }}
              type="button"
            >
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              {saving ? "Processando..." : "Solicitar baixa"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function IssueDialogBody({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <div className={cx(adminTheme.softPanel, "grid gap-3 p-4 text-sm text-slate-700 md:grid-cols-2")}>
      <DialogLine label="Valor" value={invoice.amountFormatted} />
      <DialogLine label="Vencimento" value={formatDate(invoice.dueDate)} />
      <DialogLine label="Pagador" value={invoice.student.person.fullName} />
      <DialogLine label="CPF" value={invoice.student.person.cpfMasked} />
      <p className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
        O boleto será emitido no padrão atual do contrato Sicredi, sem alterar regras financeiras, valores ou vencimento.
      </p>
    </div>
  );
}

function SyncDialogBody({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <div className={cx(adminTheme.softPanel, "p-4 text-sm leading-6 text-slate-700")}>
      <p>
        A consulta manual verificará a situação atual do boleto desta fatura e atualizará apenas os dados retornados pelo contrato atual.
      </p>
      <p className="mt-2 font-semibold text-slate-950">{invoice.student.person.fullName}</p>
    </div>
  );
}

function CancelDialogBody({
  note,
  onNoteChange,
  onReasonChange,
  reason,
  reasonOptions,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  onReasonChange: (value: InvoiceCancellationReason | "") => void;
  reason: InvoiceCancellationReason | "";
  reasonOptions: CancellationReasonOption[];
}) {
  return (
    <div className="grid gap-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
        A solicitação será registrada para o Sicredi. A baixa não é imediata e a fatura só será cancelada após confirmação bancária.
      </p>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Motivo
        <select className={adminTheme.control} onChange={(event) => onReasonChange(event.target.value as InvoiceCancellationReason | "")} value={reason}>
          <option value="">Selecione</option>
          {reasonOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Observação opcional
        <textarea
          className="min-h-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#1F6F5F] focus:ring-4 focus:ring-[#1F6F5F]/15"
          maxLength={300}
          onChange={(event) => onNoteChange(event.target.value)}
          value={note}
        />
      </label>
    </div>
  );
}

function ResultDialogBody({
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
  return (
    <div className={cx("flex gap-3 rounded-xl border p-4 text-sm leading-6", toneClass)}>
      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function DialogLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </p>
  );
}

function dialogTitle(dialog: BankSlipDialogState) {
  if (dialog.type === "issue") {
    return "Confirmar emissão de boleto";
  }
  if (dialog.type === "sync") {
    return "Consultar situação do boleto";
  }
  if (dialog.type === "cancel") {
    return "Solicitar baixa do boleto";
  }
  if (dialog.type === "error") {
    return "Erro do provedor";
  }
  return dialog.title;
}

function dialogDescription(dialog: BankSlipDialogState) {
  if (dialog.type === "issue") {
    return "Confira os dados antes de enviar a solicitação de emissão.";
  }
  if (dialog.type === "sync") {
    return "Confirme a consulta manual no Sicredi para atualizar esta fatura.";
  }
  if (dialog.type === "cancel") {
    return "Informe o motivo para registrar a solicitação de baixa.";
  }
  if (dialog.type === "error") {
    return "Detalhes preservados para análise operacional sem expor JSON bruto.";
  }
  return "Resultado da operação financeira.";
}
