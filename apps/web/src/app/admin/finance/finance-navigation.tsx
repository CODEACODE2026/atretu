import { BarChart3, Layers3, LineChart, ReceiptText, Wallet, WalletCards } from "lucide-react";
import { adminTheme, cx } from "../admin-theme";
import { type FinanceArea } from "./finance-display-utils";

const items: Array<{
  area: FinanceArea;
  description: string;
  icon: typeof BarChart3;
  label: string;
}> = [
  {
    area: "overview",
    description: "Resumo e filtros",
    icon: BarChart3,
    label: "Visão geral",
  },
  {
    area: "invoices",
    description: "Faturas e boletos",
    icon: ReceiptText,
    label: "Faturas",
  },
  {
    area: "batches",
    description: "Emissão em massa",
    icon: Layers3,
    label: "Lotes",
  },
  {
    area: "movements",
    description: "Entradas e despesas manuais",
    icon: Wallet,
    label: "Movimentações",
  },
  {
    area: "reports",
    description: "Resultado gerencial",
    icon: LineChart,
    label: "Relatórios",
  },
  {
    area: "collections",
    description: "Acompanhamento de vencidas",
    icon: WalletCards,
    label: "Cobrança e inadimplência",
  },
];

export function FinanceNavigation({
  activeArea,
  canViewCollections,
  onChange,
}: {
  activeArea: FinanceArea;
  canViewCollections: boolean;
  onChange: (area: FinanceArea) => void;
}) {
  return (
    <nav aria-label="Áreas do Financeiro" className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-6">
      {items
        .filter((item) => canViewCollections || item.area !== "collections")
        .map((item) => {
          const Icon = item.icon;
          const active = activeArea === item.area;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-[72px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition duration-150 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 motion-reduce:transition-none",
                active
                  ? "border-[#1F6F5F] bg-[#EEF7F4] text-[#0F2E2E] shadow-sm"
                  : "border-slate-200/80 bg-white/90 text-slate-700 hover:border-[#8DB7AD] hover:bg-[#F8FAFA]",
              )}
              key={item.area}
              onClick={() => onChange(item.area)}
              type="button"
            >
              <span className={cx("grid h-10 w-10 place-items-center rounded-lg", active ? adminTheme.atretuMark : "bg-slate-100 text-slate-600")}>
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
              </span>
            </button>
          );
        })}
    </nav>
  );
}
