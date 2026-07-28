import type { CollectionActionType } from "../../../../lib/api";
import { adminTheme, cx } from "../../admin-theme";
import {
  collectionActionTypeLabel,
  collectionActionTypes,
} from "../../collection-formatters";
import { collectionActionHelp } from "./collection-action-display-utils";
import type { CollectionActionFormState } from "../../collection-action-validation";

export function CollectionActionTypeSelector({
  disabled,
  error,
  updateField,
  value,
}: {
  disabled: boolean;
  error?: string;
  updateField: <K extends keyof CollectionActionFormState>(
    key: K,
    value: CollectionActionFormState[K],
  ) => void;
  value: CollectionActionType | "";
}) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
        Tipo da acao
      </span>
      <select
        className={cx(adminTheme.control, "w-full")}
        disabled={disabled}
        onChange={(event) =>
          updateField("actionType", event.target.value as CollectionActionType | "")
        }
        value={value}
      >
        <option value="">Selecione</option>
        {collectionActionTypes.map((type) => (
          <option key={type} value={type}>
            {collectionActionTypeLabel(type)}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-slate-500">
        {collectionActionHelp(value)}
      </span>
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
