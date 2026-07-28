import type { CollectionPriority } from "../../../../lib/api";
import { cx } from "../../admin-theme";
import { collectionPriorityLabel } from "../../collection-formatters";
import { collectionPriorityTone } from "./collection-display-utils";

export function CollectionPriorityBadge({
  priority,
}: {
  priority: CollectionPriority;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        collectionPriorityTone(priority),
      )}
    >
      {collectionPriorityLabel(priority)}
    </span>
  );
}
