import type { ReactNode } from "react";
import type { CollectionAction } from "../../../../lib/api";
import {
  collectionActionTypeLabel,
  collectionChannelLabel,
} from "../../collection-formatters";
import {
  formatCents,
  formatCollectionDate,
  formatCollectionDateTime,
} from "./collection-display-utils";

export function CollectionHistoryItem({ action }: { action: CollectionAction }) {
  return (
    <article className="relative border-l-2 border-slate-200 pb-4 pl-4 last:pb-0">
      <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-slate-900" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">
            {collectionActionTypeLabel(action.actionType)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatCollectionDateTime(action.createdAt)} -{" "}
            {action.createdByUser?.name ?? "Sistema"}
          </p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
          {action.source}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">
        {action.note}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <Badge>Canal: {collectionChannelLabel(action.channel)}</Badge>
        {action.contactedName ? <Badge>Contato: {action.contactedName}</Badge> : null}
        {action.contactedDocumentMasked ? (
          <Badge>Documento: {action.contactedDocumentMasked}</Badge>
        ) : null}
        {action.promisedAmountCents ? (
          <Badge>Promessa: {formatCents(action.promisedAmountCents)}</Badge>
        ) : null}
        {action.promiseDueDate ? (
          <Badge>Data promessa: {formatCollectionDate(action.promiseDueDate)}</Badge>
        ) : null}
        {action.nextFollowUpAt ? (
          <Badge>Retorno: {formatCollectionDateTime(action.nextFollowUpAt)}</Badge>
        ) : null}
      </div>
    </article>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
      {children}
    </span>
  );
}
