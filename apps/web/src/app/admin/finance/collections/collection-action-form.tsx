"use client";

import { FormEvent, useRef, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import {
  api,
  type CollectionAction,
  type CollectionCaseDetail,
} from "../../../../lib/api";
import { mapApiErrorMessage } from "../../../../lib/formatters";
import { formatDate } from "../../../../lib/formatters/date";
import { adminTheme, cx } from "../../admin-theme";
import {
  emptyCollectionActionForm,
  validateCollectionActionForm,
  type CollectionActionFormState,
} from "../../collection-action-validation";
import { CollectionActionFeedback } from "./collection-action-feedback";
import { CollectionActionFields } from "./collection-action-fields";
import { CollectionActionTypeSelector } from "./collection-action-type-selector";
import {
  collectionActionShowsChannel,
  collectionActionShowsContact,
  collectionActionShowsFollowUp,
  collectionActionShowsPromise,
} from "./collection-action-display-utils";

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
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const canSubmit = caseDetail.invoiceStatus === "OPEN";

  function updateField<K extends FieldName>(
    key: K,
    value: CollectionActionFormState[K],
  ) {
    setForm((current) => {
      if (key !== "actionType") {
        return { ...current, [key]: value };
      }
      const actionType = value as CollectionActionFormState["actionType"];
      const next: CollectionActionFormState = { ...current, actionType };

      if (!collectionActionShowsChannel(actionType)) {
        next.channel = "";
      }
      if (!collectionActionShowsContact(actionType)) {
        next.contactedName = "";
        next.contactedDocumentMasked = "";
      }
      if (!collectionActionShowsPromise(actionType)) {
        next.promisedAmountReais = "";
        next.promiseDueDate = "";
      }
      if (!collectionActionShowsFollowUp(actionType)) {
        next.nextFollowUpAt = "";
      }

      return next;
    });
    setErrors((current) => ({ ...current, [key]: undefined }));
    setApiError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submittingRef.current) {
      return;
    }
    const validation = validateCollectionActionForm(form);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setApiError("");
    setSuccess("");
    try {
      const action = await api.createCollectionAction(
        caseDetail.invoiceId,
        validation.body,
      );
      setForm(emptyCollectionActionForm);
      setSuccess("Acao registrada com sucesso.");
      await onCreated(action);
    } catch (caught) {
      setApiError(readError(caught, "Nao foi possivel registrar a acao"));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (!canSubmit) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Esta fatura esta {caseDetail.invoiceStatus.toLowerCase()} e nao aceita
        novas acoes operacionais. O historico permanece disponivel para
        consulta.
      </div>
    );
  }

  return (
    <form
      className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950">
            Registrar acao de cobranca
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {caseDetail.student.person.fullName} - vencimento{" "}
            {formatDate(caseDetail.dueDate)}. A origem MANUAL continua definida
            pelo backend.
          </p>
        </div>
        <button
          className={cx(adminTheme.secondaryButton, "w-fit")}
          disabled={submitting}
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden className="h-4 w-4" />
          Cancelar
        </button>
      </div>

      <CollectionActionFeedback error={apiError} success={success} />

      <div className="mt-4 grid gap-4">
        <CollectionActionTypeSelector
          disabled={submitting}
          error={errors.actionType}
          updateField={updateField}
          value={form.actionType}
        />
        <CollectionActionFields
          disabled={submitting}
          errors={errors}
          form={form}
          updateField={updateField}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          className={adminTheme.primaryButton}
          disabled={submitting}
          type="submit"
        >
          {submitting ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <Save aria-hidden className="h-4 w-4" />
          )}
          {submitting ? "Registrando..." : "Registrar acao"}
        </button>
      </div>
    </form>
  );
}

function readError(caught: unknown, fallback: string) {
  return caught instanceof Error ? mapApiErrorMessage(caught.message) : fallback;
}
