import { BarChart3, Layers3, LineChart, ReceiptText, Wallet, WalletCards } from "lucide-react";
import { cx } from "../admin-theme";
import { type FinanceArea } from "./finance-display-utils";

const items: Array<{
  ariaLabel?: string;
  area: FinanceArea;
  icon: typeof BarChart3;
  label: string;
}> = [
  {
    area: "overview",
    icon: BarChart3,
    label: "Visão geral",
  },
  {
    area: "invoices",
    icon: ReceiptText,
    label: "Faturas",
  },
  {
    area: "batches",
    icon: Layers3,
    label: "Lotes",
  },
  {
    ariaLabel: "Entradas e despesas manuais",
    area: "movements",
    icon: Wallet,
    label: "Movimentações",
  },
  {
    area: "reports",
    icon: LineChart,
    label: "Relatórios",
  },
  {
    ariaLabel: "Cobrança e inadimplência",
    area: "collections",
    icon: WalletCards,
    label: "Cobrança",
  },
];

export function FinanceNavigation({
  activeArea,
  canManageFinance,
  canViewCollections,
  onChange,
}: {
  activeArea: FinanceArea;
  canManageFinance: boolean;
  canViewCollections: boolean;
  onChange: (area: FinanceArea) => void;
}) {
  const visibleItems = items.filter((item) => {
    if (item.area === "collections") {
      return canViewCollections;
    }
    if (
      item.area === "batches" ||
      item.area === "movements" ||
      item.area === "reports"
    ) {
      return canManageFinance;
    }
    return true;
  });

  return (
    <nav aria-label="Áreas do Financeiro" className="min-w-0 overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      <div className="flex min-w-max gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = activeArea === item.area;
          return (
            <button
              aria-current={active ? "page" : undefined}
              aria-label={item.ariaLabel}
              className={cx(
                "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition duration-150 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 motion-reduce:transition-none",
                active
                  ? "bg-[#1F6F5F] text-white shadow-sm"
                  : "text-slate-600 hover:bg-[#EEF7F4] hover:text-[#0F2E2E]",
              )}
              key={item.area}
              onClick={() => onChange(item.area)}
              type="button"
            >
              <span className={cx("grid h-6 w-6 place-items-center rounded", active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500")}>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
