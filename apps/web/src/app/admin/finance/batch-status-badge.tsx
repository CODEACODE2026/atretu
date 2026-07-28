import {
  type BankSlipIssueBatch,
  type BankSlipIssueBatchItem,
} from "../../../lib/api";
import { cx } from "../admin-theme";
import {
  batchItemStatusLabel,
  batchStatusLabel,
  batchVisualStatus,
} from "./batch-display-utils";

const batchToneClass = {
  cancelled: "border-slate-200 bg-slate-100 text-slate-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  processing: "border-blue-200 bg-blue-50 text-blue-700",
  queued: "border-slate-200 bg-slate-50 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const itemToneClass: Record<BankSlipIssueBatchItem["status"], string> = {
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
  FAILED: "border-red-200 bg-red-50 text-red-700",
  ISSUED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PROCESSING: "border-blue-200 bg-blue-50 text-blue-700",
  QUEUED: "border-slate-200 bg-slate-50 text-slate-700",
  SKIPPED: "border-amber-200 bg-amber-50 text-amber-700",
  UNKNOWN: "border-orange-200 bg-orange-50 text-orange-700",
};

const base =
  "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold";

export function BatchStatusBadge({ batch }: { batch: BankSlipIssueBatch }) {
  return (
    <span className={cx(base, batchToneClass[batchVisualStatus(batch)])}>
      {batchStatusLabel(batch)}
    </span>
  );
}

export function BatchItemStatusBadge({
  status,
}: {
  status: BankSlipIssueBatchItem["status"];
}) {
  return (
    <span className={cx(base, itemToneClass[status])}>
      {batchItemStatusLabel(status)}
    </span>
  );
}
