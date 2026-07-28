import { Search, XCircle } from "lucide-react";
import type {
  AcademicYear,
  BaseRecord,
  CollectionAction,
  CollectionAgingBucket,
  CollectionOperationalStatus,
} from "../../../../lib/api";
import { adminTheme, cx } from "../../admin-theme";
import {
  collectionActionTypeLabel,
  collectionActionTypes,
  collectionAgingBucketLabel,
  collectionOperationalStatusLabel,
} from "../../collection-formatters";
import {
  collectionAgingBuckets,
  collectionOperationalStatuses,
  type CollectionFilters,
  hasActiveCollectionFilters,
} from "./collection-display-utils";

export function CollectionFiltersBar({
  filters,
  institutions,
  onClear,
  searchInput,
  setSearchInput,
  updateFilter,
  years,
}: {
  filters: CollectionFilters;
  institutions: BaseRecord[];
  onClear: () => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  updateFilter: <K extends keyof CollectionFilters>(
    key: K,
    value: CollectionFilters[K],
  ) => void;
  years: AcademicYear[];
}) {
  const hasFilters = hasActiveCollectionFilters(filters) || searchInput.trim() !== "";

  return (
    <div className="mt-5 grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Filtros</h3>
          <p className="text-xs text-slate-500">
            Recorte a fila sem alterar as regras de cobranca.
          </p>
        </div>
        <button
          className={adminTheme.secondaryButton}
          disabled={!hasFilters}
          onClick={onClear}
          type="button"
        >
          <XCircle aria-hidden className="h-4 w-4" />
          Limpar
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.35fr)_minmax(0,2fr)]">
        <label className="relative min-w-0">
          <span className="sr-only">Buscar aluno</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            className={cx(adminTheme.control, "w-full pl-9")}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar aluno, responsavel ou contato"
            type="search"
            value={searchInput}
          />
        </label>

        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <select
            className={cx(adminTheme.control, "min-w-0")}
            onChange={(event) => updateFilter("institutionId", event.target.value)}
            value={filters.institutionId}
          >
            <option value="">Instituicao</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
          <select
            className={cx(adminTheme.control, "min-w-0")}
            onChange={(event) => updateFilter("academicYearId", event.target.value)}
            value={filters.academicYearId}
          >
            <option value="">Ano letivo</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </select>
          <select
            className={cx(adminTheme.control, "min-w-0")}
            onChange={(event) =>
              updateFilter(
                "agingBucket",
                event.target.value as CollectionAgingBucket | "",
              )
            }
            value={filters.agingBucket}
          >
            <option value="">Faixa de atraso</option>
            {collectionAgingBuckets.map((bucket) => (
              <option key={bucket} value={bucket}>
                {collectionAgingBucketLabel(bucket)}
              </option>
            ))}
          </select>
          <select
            className={cx(adminTheme.control, "min-w-0")}
            onChange={(event) =>
              updateFilter(
                "operationalStatus",
                event.target.value as CollectionOperationalStatus | "",
              )
            }
            value={filters.operationalStatus}
          >
            <option value="">Status operacional</option>
            {collectionOperationalStatuses.map((status) => (
              <option key={status} value={status}>
                {collectionOperationalStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className={cx(adminTheme.control, "min-w-0")}
          onChange={(event) => updateFilter("dueDateFrom", event.target.value)}
          type="date"
          value={filters.dueDateFrom}
        />
        <input
          className={cx(adminTheme.control, "min-w-0")}
          onChange={(event) => updateFilter("dueDateTo", event.target.value)}
          type="date"
          value={filters.dueDateTo}
        />
        <select
          className={cx(adminTheme.control, "min-w-0")}
          onChange={(event) =>
            updateFilter(
              "actionType",
              event.target.value as CollectionAction["actionType"] | "",
            )
          }
          value={filters.actionType}
        >
          <option value="">Tipo da acao</option>
          {collectionActionTypes.map((type) => (
            <option key={type} value={type}>
              {collectionActionTypeLabel(type)}
            </option>
          ))}
        </select>
        <input
          className={cx(adminTheme.control, "min-w-0")}
          onChange={(event) => updateFilter("followUpFrom", event.target.value)}
          type="date"
          value={filters.followUpFrom}
        />
        <input
          className={cx(adminTheme.control, "min-w-0")}
          onChange={(event) => updateFilter("followUpTo", event.target.value)}
          type="date"
          value={filters.followUpTo}
        />
      </div>
    </div>
  );
}
