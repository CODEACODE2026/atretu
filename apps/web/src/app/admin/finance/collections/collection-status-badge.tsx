import type { CollectionOperationalStatus } from "../../../../lib/api";
import { cx } from "../../admin-theme";
import { collectionOperationalStatusLabel } from "../../collection-formatters";
import { collectionStatusTone } from "./collection-display-utils";

export function CollectionStatusBadge({
  status,
}: {
  status: CollectionOperationalStatus;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        collectionStatusTone(status),
      )}
    >
      {collectionOperationalStatusLabel(status)}
    </span>
  );
}
