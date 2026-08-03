import { FormEvent } from "react";
import { SlidersHorizontal, Search, XCircle } from "lucide-react";
import { type AcademicYear, type BaseRecord, type InvoiceStatus } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";

export function FinanceFilters({
  academicYearId,
  dueDateFrom,
  dueDateTo,
  hasActiveFilters,
  institutionId,
  institutions,
  loading,
  onClear,
  onSubmit,
  overdue,
  paidAtFrom,
  paidAtTo,
  search,
  setAcademicYearId,
  setDueDateFrom,
  setDueDateTo,
  setInstitutionId,
  setOverdue,
  setPaidAtFrom,
  setPaidAtTo,
  setSearch,
  setStatus,
  status,
  years,
}: {
  academicYearId: string;
  dueDateFrom: string;
  dueDateTo: string;
  hasActiveFilters: boolean;
  institutionId: string;
  institutions: BaseRecord[];
  loading: boolean;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  overdue: "all" | "overdue" | "notOverdue";
  paidAtFrom: string;
  paidAtTo: string;
  search: string;
  setAcademicYearId: (value: string) => void;
  setDueDateFrom: (value: string) => void;
  setDueDateTo: (value: string) => void;
  setInstitutionId: (value: string) => void;
  setOverdue: (value: "all" | "overdue" | "notOverdue") => void;
  setPaidAtFrom: (value: string) => void;
  setPaidAtTo: (value: string) => void;
  setSearch: (value: string) => void;
  setStatus: (value: InvoiceStatus | "") => void;
  status: InvoiceStatus | "";
  years: AcademicYear[];
}) {
  return (
    <section className={cx(adminTheme.card, "min-w-0 p-5")} aria-labelledby="finance-filters-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={cx(adminTheme.titleText, "text-base")} id="finance-filters-title">
            Filtros
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Refine a lista por acadêmico, matrícula, instituição, situação, vencimento e pagamento.
          </p>
        </div>
        {loading ? <span className="text-sm text-slate-500">Carregando resultados...</span> : null}
      </div>

      <form className="mt-4 grid min-w-0 gap-4" onSubmit={onSubmit}>
        <div className="grid min-w-0 gap-3 rounded-xl border border-slate-200/80 bg-[#F8FAFA]/80 p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_minmax(160px,0.7fr)_minmax(180px,0.8fr)_minmax(150px,0.6fr)]">
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            Busca
            <input
              className={cx(adminTheme.control, "w-full")}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou CPF"
              type="search"
              value={search}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            Ano letivo
            <select className={cx(adminTheme.control, "w-full")} onChange={(event) => setAcademicYearId(event.target.value)} value={academicYearId}>
              <option value="">Todos</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            Instituição
            <select className={cx(adminTheme.control, "w-full")} onChange={(event) => setInstitutionId(event.target.value)} value={institutionId}>
              <option value="">Todas</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
            Situação
            <select className={cx(adminTheme.control, "w-full")} onChange={(event) => setStatus(event.target.value as InvoiceStatus | "")} value={status}>
              <option value="">Todas</option>
              <option value="OPEN">Aberta</option>
              <option value="PAID">Paga</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </label>
        </div>
        <details className="min-w-0 md:col-span-2 xl:col-span-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#8DB7AD] [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal aria-hidden className="h-4 w-4" />
            Filtros avançados
          </summary>
          <div className="mt-3 grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Status de vencimento
              <select className={cx(adminTheme.control, "w-full")} onChange={(event) => setOverdue(event.target.value as "all" | "overdue" | "notOverdue")} value={overdue}>
                <option value="all">Todas</option>
                <option value="overdue">Vencidas</option>
                <option value="notOverdue">Não vencidas</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Vencimento de
              <input className={cx(adminTheme.control, "w-full")} onChange={(event) => setDueDateFrom(event.target.value)} type="date" value={dueDateFrom} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Vencimento até
              <input className={cx(adminTheme.control, "w-full")} onChange={(event) => setDueDateTo(event.target.value)} type="date" value={dueDateTo} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Pagamento de
              <input className={cx(adminTheme.control, "w-full")} onChange={(event) => setPaidAtFrom(event.target.value)} type="date" value={paidAtFrom} />
            </label>
            <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
              Pagamento até
              <input className={cx(adminTheme.control, "w-full")} onChange={(event) => setPaidAtTo(event.target.value)} type="date" value={paidAtTo} />
            </label>
          </div>
        </details>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
          <button className={adminTheme.primaryButton} disabled={loading} type="submit">
            <Search aria-hidden="true" className="h-4 w-4" />
            Buscar
          </button>
          <button className={adminTheme.secondaryButton} disabled={!hasActiveFilters || loading} onClick={onClear} type="button">
            <XCircle aria-hidden="true" className="h-4 w-4" />
            Limpar filtros
          </button>
        </div>
      </form>
    </section>
  );
}
