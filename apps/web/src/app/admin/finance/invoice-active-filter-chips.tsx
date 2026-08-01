import { XCircle } from "lucide-react";
import { type AcademicYear, type BaseRecord, type InvoiceStatus } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { quickFilterLabel, type InvoiceQuickFilter } from "./invoice-display-utils";

type OverdueFilter = "all" | "overdue" | "notOverdue";

export function InvoiceActiveFilterChips({
  academicYearId,
  dueDateFrom,
  dueDateTo,
  institutionId,
  institutions,
  onClear,
  overdue,
  paidAtFrom,
  paidAtTo,
  quickFilter,
  search,
  status,
  years,
}: {
  academicYearId: string;
  dueDateFrom: string;
  dueDateTo: string;
  institutionId: string;
  institutions: BaseRecord[];
  onClear: () => void;
  overdue: OverdueFilter;
  paidAtFrom: string;
  paidAtTo: string;
  quickFilter: InvoiceQuickFilter;
  search: string;
  status: InvoiceStatus | "";
  years: AcademicYear[];
}) {
  const chips = [
    search ? `Busca: ${search}` : "",
    status ? `Situação: ${statusLabel(status)}` : "",
    institutionId ? `Instituição: ${institutions.find((item) => item.id === institutionId)?.name ?? "selecionada"}` : "",
    academicYearId ? `Ano: ${years.find((item) => item.id === academicYearId)?.year ?? "selecionado"}` : "",
    overdue !== "all" ? `Vencimento: ${overdue === "overdue" ? "vencidas" : "não vencidas"}` : "",
    dueDateFrom ? `Vencimento de: ${dueDateFrom}` : "",
    dueDateTo ? `Vencimento até: ${dueDateTo}` : "",
    paidAtFrom ? `Pagamento de: ${paidAtFrom}` : "",
    paidAtTo ? `Pagamento até: ${paidAtTo}` : "",
    quickFilter !== "all" ? `Atalho: ${quickFilterLabel(quickFilter)}` : "",
  ].filter(Boolean);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
          key={chip}
        >
          <span className="truncate">{chip}</span>
        </span>
      ))}
      <button className={cx(adminTheme.secondaryButton, "h-8 px-2 text-xs")} onClick={onClear} type="button">
        <XCircle aria-hidden className="h-3.5 w-3.5" />
        Limpar
      </button>
    </div>
  );
}

function statusLabel(status: InvoiceStatus) {
  if (status === "OPEN") return "aberta";
  if (status === "PAID") return "paga";
  return "cancelada";
}
