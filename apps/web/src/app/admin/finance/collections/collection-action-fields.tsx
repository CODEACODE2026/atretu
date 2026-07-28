import type { ReactNode } from "react";
import type { CollectionChannel } from "../../../../lib/api";
import { adminTheme, cx } from "../../admin-theme";
import {
  collectionChannelLabel,
  collectionChannels,
} from "../../collection-formatters";
import type { CollectionActionFormState } from "../../collection-action-validation";
import {
  collectionActionShowsChannel,
  collectionActionShowsContact,
  collectionActionShowsFollowUp,
  collectionActionShowsPromise,
} from "./collection-action-display-utils";

type FieldName = keyof CollectionActionFormState;

export function CollectionActionFields({
  disabled,
  errors,
  form,
  updateField,
}: {
  disabled: boolean;
  errors: Partial<Record<FieldName, string>>;
  form: CollectionActionFormState;
  updateField: <K extends FieldName>(
    key: K,
    value: CollectionActionFormState[K],
  ) => void;
}) {
  const showChannel = collectionActionShowsChannel(form.actionType);
  const showContact = collectionActionShowsContact(form.actionType);
  const showPromise = collectionActionShowsPromise(form.actionType);
  const showFollowUp = collectionActionShowsFollowUp(form.actionType);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {showChannel ? (
        <FieldError label="Canal" error={errors.channel}>
          <select
            className={cx(adminTheme.control, "w-full")}
            disabled={disabled}
            onChange={(event) =>
              updateField("channel", event.target.value as CollectionChannel | "")
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

      {showContact ? (
        <>
          <FieldError label="Pessoa contatada" error={errors.contactedName}>
            <input
              className={cx(adminTheme.control, "w-full")}
              disabled={disabled}
              maxLength={160}
              onChange={(event) => updateField("contactedName", event.target.value)}
              value={form.contactedName}
            />
          </FieldError>
          <FieldError
            label="Documento mascarado"
            error={errors.contactedDocumentMasked}
          >
            <input
              className={cx(adminTheme.control, "w-full")}
              disabled={disabled}
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

      {showPromise ? (
        <>
          <FieldError label="Valor prometido" error={errors.promisedAmountReais}>
            <input
              className={cx(adminTheme.control, "w-full")}
              disabled={disabled}
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
              className={cx(adminTheme.control, "w-full")}
              disabled={disabled}
              onChange={(event) => updateField("promiseDueDate", event.target.value)}
              type="date"
              value={form.promiseDueDate}
            />
          </FieldError>
        </>
      ) : null}

      {showFollowUp ? (
        <FieldError label="Proximo follow-up" error={errors.nextFollowUpAt}>
          <input
            className={cx(adminTheme.control, "w-full")}
            disabled={disabled}
            onChange={(event) => updateField("nextFollowUpAt", event.target.value)}
            type="datetime-local"
            value={form.nextFollowUpAt}
          />
        </FieldError>
      ) : null}

      <div className="lg:col-span-2">
        <FieldError label="Observacao" error={errors.note}>
          <textarea
            className="min-h-32 w-full rounded-lg border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-[#1F6F5F] focus:ring-4 focus:ring-[#1F6F5F]/15 disabled:bg-slate-50 disabled:text-slate-400"
            disabled={disabled}
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
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
