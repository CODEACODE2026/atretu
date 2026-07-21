"use client";

import { FormEvent, ReactNode, useState } from "react";
import {
  api,
  type CollectionAction,
  type CollectionActionType,
  type CollectionCaseDetail,
} from "../../lib/api";
import { mapApiErrorMessage } from "../../lib/formatters";
import { formatDate } from "../../lib/formatters/date";
import {
  collectionActionTypeLabel,
  collectionActionTypes,
  collectionChannelLabel,
  collectionChannels,
} from "./collection-formatters";
import {
  emptyCollectionActionForm,
  validateCollectionActionForm,
  type CollectionActionFormState,
} from "./collection-action-validation";

type FieldName = keyof CollectionActionFormState;

export function CollectionActionForm({
  caseDetail,
  onCancel,
  onCreated,
}: {
  caseDetail: CollectionCaseDetail;
  onCancel: () => void;
  onCreated: (action: CollectionAction) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CollectionActionFormState>(
    emptyCollectionActionForm,
  );
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = caseDetail.invoiceStatus === "OPEN";
  const isContactAction =
    form.actionType === "CONTACT_ATTEMPT" ||
    form.actionType === "CONTACT_MADE" ||
    form.actionType === "NO_CONTACT";

  function updateField<K extends FieldName>(
    key: K,
    value: CollectionActionFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }
    const validation = validateCollectionActionForm(form);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setSubmitting(true);
    setApiError("");
    try {
      const action = await api.createCollectionAction(
        caseDetail.invoiceId,
        validation.body,
      );
      setForm(emptyCollectionActionForm);
      await onCreated(action);
    } catch (caught) {
      setApiError(readError(caught, "Nao foi possivel registrar a acao"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!canSubmit) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Esta fatura esta {caseDetail.invoiceStatus.toLowerCase()} e nao aceita
        novas acoes operacionais. O historico permanece disponivel para
        consulta.
      </div>
    );
  }

  return (
    <form
      className="rounded border border-slate-200 bg-slate-50 p-4"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Registrar acao de cobranca
          </h3>
          <p className="text-xs text-slate-500">
            {caseDetail.student.person.fullName} - vencimento{" "}
            {formatDate(caseDetail.dueDate)}. A acao sera registrada no
            historico.
          </p>
        </div>
        <button
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          disabled={submitting}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
      </div>

      {apiError ? (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {apiError}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FieldError label="Tipo de acao" error={errors.actionType}>
          <select
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            disabled={submitting}
            onChange={(event) =>
              updateField(
                "actionType",
                event.target.value as CollectionActionType | "",
              )
            }
            value={form.actionType}
          >
            <option value="">Selecione</option>
            {collectionActionTypes.map((type) => (
              <option key={type} value={type}>
                {collectionActionTypeLabel(type)}
              </option>
            ))}
          </select>
        </FieldError>

        {(isContactAction || form.actionType === "PROMISE_TO_PAY") ? (
          <FieldError label="Canal" error={errors.channel}>
            <select
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={submitting}
              onChange={(event) =>
                updateField("channel", event.target.value as typeof form.channel)
              }
              value={form.channel}
            >
              <option value="">Selecione</option>
              {collectionChannels.map((channel) => (
                <option key={channel} value={channel}>
                  {collectionChannelLabel(channel)}
                </option>
              ))}
            </select>
          </FieldError>
        ) : null}

        {(isContactAction || form.actionType === "PROMISE_TO_PAY") ? (
          <>
            <FieldError label="Pessoa contatada" error={errors.contactedName}>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                disabled={submitting}
                maxLength={160}
                onChange={(event) =>
                  updateField("contactedName", event.target.value)
                }
                value={form.contactedName}
              />
            </FieldError>
            <FieldError
              label="Documento mascarado"
              error={errors.contactedDocumentMasked}
            >
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                disabled={submitting}
                maxLength={30}
                onChange={(event) =>
                  updateField("contactedDocumentMasked", event.target.value)
                }
                placeholder="Ex.: ***.123.456-**"
                value={form.contactedDocumentMasked}
              />
            </FieldError>
          </>
        ) : null}

        {form.actionType === "PROMISE_TO_PAY" ? (
          <>
            <FieldError
              label="Valor prometido"
              error={errors.promisedAmountReais}
            >
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                disabled={submitting}
                inputMode="decimal"
                onChange={(event) =>
                  updateField("promisedAmountReais", event.target.value)
                }
                placeholder="Ex.: 100,00"
                value={form.promisedAmountReais}
              />
            </FieldError>
            <FieldError label="Data da promessa" error={errors.promiseDueDate}>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                disabled={submitting}
                onChange={(event) =>
                  updateField("promiseDueDate", event.target.value)
                }
                type="date"
                value={form.promiseDueDate}
              />
            </FieldError>
          </>
        ) : null}

        {(form.actionType === "FOLLOW_UP_SCHEDULED" ||
          form.actionType === "PROMISE_TO_PAY" ||
          form.actionType === "NO_CONTACT") ? (
          <FieldError label="Proximo retorno" error={errors.nextFollowUpAt}>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={submitting}
              onChange={(event) =>
                updateField("nextFollowUpAt", event.target.value)
              }
              type="datetime-local"
              value={form.nextFollowUpAt}
            />
          </FieldError>
        ) : null}

        <div className="md:col-span-2">
          <FieldError label="Observacao" error={errors.note}>
            <textarea
              className="min-h-28 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              disabled={submitting}
              maxLength={1000}
              onChange={(event) => updateField("note", event.target.value)}
              value={form.note}
            />
          </FieldError>
          <p className="mt-1 text-right text-xs text-slate-500">
            {form.note.length}/1000
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          disabled={submitting}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Registrando..." : "Registrar acao"}
        </button>
      </div>
    </form>
  );
}

function FieldError({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="text-sm text-slate-700">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function readError(caught: unknown, fallback: string) {
  return caught instanceof Error ? mapApiErrorMessage(caught.message) : fallback;
}
