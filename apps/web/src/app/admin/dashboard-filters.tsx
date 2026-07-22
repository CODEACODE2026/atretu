"use client";

import { Filter, RotateCcw } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  api,
  type AcademicYear,
  type BaseRecord,
  type DashboardOverviewParams,
} from "../../lib/api";
import { adminTheme, cx } from "./admin-theme";

type FilterOptions = {
  academicYears: AcademicYear[];
  institutions: BaseRecord[];
};

type OptionsState = "idle" | "loading" | "loaded" | "error";

let cachedOptions: FilterOptions | null = null;
let pendingOptions: Promise<FilterOptions> | null = null;

function loadFilterOptions() {
  if (cachedOptions) {
    return Promise.resolve(cachedOptions);
  }

  if (pendingOptions) {
    return pendingOptions;
  }

  pendingOptions = Promise.all([
    api.listAcademicYears({ status: "all" }),
    api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
  ])
    .then(([yearsResponse, institutionsResponse]) => {
      cachedOptions = {
        academicYears: yearsResponse.data,
        institutions: institutionsResponse.data,
      };
      return cachedOptions;
    })
    .finally(() => {
      pendingOptions = null;
    });

  return pendingOptions;
}

export function DashboardFilters({
  appliedParams,
  disabled,
  onApply,
}: {
  appliedParams: DashboardOverviewParams;
  disabled: boolean;
  onApply: (params: DashboardOverviewParams) => void;
}) {
  const [academicYearId, setAcademicYearId] = useState(
    appliedParams.academicYearId ?? "",
  );
  const [institutionId, setInstitutionId] = useState(
    appliedParams.institutionId ?? "",
  );
  const [options, setOptions] = useState<FilterOptions>({
    academicYears: [],
    institutions: [],
  });
  const [optionsState, setOptionsState] = useState<OptionsState>(
    cachedOptions ? "loaded" : "idle",
  );
  const [optionsError, setOptionsError] = useState("");

  useEffect(() => {
    setAcademicYearId(appliedParams.academicYearId ?? "");
    setInstitutionId(appliedParams.institutionId ?? "");
  }, [appliedParams.academicYearId, appliedParams.institutionId]);

  useEffect(() => {
    let active = true;

    setOptionsState(cachedOptions ? "loaded" : "loading");
    setOptionsError("");

    loadFilterOptions()
      .then((loadedOptions) => {
        if (active) {
          setOptions(loadedOptions);
          setOptionsState("loaded");
        }
      })
      .catch((caught) => {
        if (active) {
          setOptionsError(
            caught instanceof Error
              ? caught.message
              : "Nao foi possivel carregar os filtros",
          );
          setOptionsState("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const draftParams = useMemo(
    () => normalizeParams({ academicYearId, institutionId }),
    [academicYearId, institutionId],
  );
  const normalizedApplied = useMemo(
    () => normalizeParams(appliedParams),
    [appliedParams],
  );
  const hasChanges = !sameParams(draftParams, normalizedApplied);
  const hasDraftValues = Boolean(draftParams.academicYearId || draftParams.institutionId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges || disabled) {
      return;
    }
    onApply(draftParams);
  }

  function handleClear() {
    setAcademicYearId("");
    setInstitutionId("");
    if (normalizedApplied.academicYearId || normalizedApplied.institutionId) {
      onApply({});
    }
  }

  return (
    <form
      className={cx(
        adminTheme.softPanel,
        "grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]",
      )}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-1.5">
        <label
          className="text-xs font-semibold text-slate-500"
          htmlFor="dashboard-academic-year"
        >
          Ano letivo
        </label>
        <select
          className={adminTheme.control}
          disabled={disabled || optionsState === "loading"}
          id="dashboard-academic-year"
          onChange={(event) => setAcademicYearId(event.target.value)}
          value={academicYearId}
        >
          <option value="">
            {optionsState === "loading" ? "Carregando anos" : "Ano atual"}
          </option>
          {academicYearId && !options.academicYears.some((year) => year.id === academicYearId) ? (
            <option value={academicYearId}>Ano selecionado</option>
          ) : null}
          {options.academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {formatAcademicYearLabel(year)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <label
          className="text-xs font-semibold text-slate-500"
          htmlFor="dashboard-institution"
        >
          Instituicao
        </label>
        <select
          className={adminTheme.control}
          disabled={disabled || optionsState === "loading"}
          id="dashboard-institution"
          onChange={(event) => setInstitutionId(event.target.value)}
          value={institutionId}
        >
          <option value="">
            {optionsState === "loading" ? "Carregando instituicoes" : "Todas"}
          </option>
          {institutionId &&
          !options.institutions.some((institution) => institution.id === institutionId) ? (
            <option value={institutionId}>Instituicao selecionada</option>
          ) : null}
          {options.institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </select>
      </div>

      <button
        className={cx(adminTheme.primaryButton, "self-end")}
        disabled={disabled || !hasChanges}
        type="submit"
      >
        <Filter size={16} />
        Aplicar filtros
      </button>
      <button
        className={cx(adminTheme.secondaryButton, "self-end")}
        disabled={disabled || (!hasChanges && !hasDraftValues)}
        onClick={handleClear}
        type="button"
      >
        <RotateCcw size={16} />
        Limpar
      </button>

      {optionsState === "error" ? (
        <p className="text-xs text-amber-700 lg:col-span-4">
          {optionsError}. Os dados do Dashboard continuam disponiveis.
        </p>
      ) : null}
    </form>
  );
}

function normalizeParams(params: DashboardOverviewParams): DashboardOverviewParams {
  return {
    academicYearId: params.academicYearId?.trim() || undefined,
    institutionId: params.institutionId?.trim() || undefined,
  };
}

function sameParams(
  left: DashboardOverviewParams,
  right: DashboardOverviewParams,
) {
  return (
    (left.academicYearId ?? "") === (right.academicYearId ?? "") &&
    (left.institutionId ?? "") === (right.institutionId ?? "")
  );
}

function formatAcademicYearLabel(year: AcademicYear) {
  return year.isCurrent ? `Ano Letivo ${year.year} - atual` : `Ano Letivo ${year.year}`;
}
