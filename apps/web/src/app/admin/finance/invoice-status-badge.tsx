import { cx } from "../admin-theme";
import { badgeToneClass, bankSlipPresentation, invoicePresentation, type BankSlipListRecord } from "./finance-display-utils";
import { type InvoiceRecord } from "../../../lib/api";

const badgeBase = "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold";

export function InvoiceStatusBadge({ invoice }: { invoice: InvoiceRecord }) {
  const presentation = invoicePresentation(invoice);
  return (
    <span className={cx(badgeBase, badgeToneClass(presentation.tone))}>
      {presentation.label}
    </span>
  );
}

export function BankSlipStatusBadge({
  bankSlip,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
}) {
  const presentation = bankSlipPresentation(bankSlip);
  return (
    <span className={cx(badgeBase, badgeToneClass(presentation.tone))}>
      {presentation.label}
    </span>
  );
}
