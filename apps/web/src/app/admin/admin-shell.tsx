"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type BaseRecord,
  type BusAssignmentRecord,
  type BusRecord,
  type ListRecordsParams,
} from "../../lib/api";
import { canAccessRestrictedAdmin, getPrimaryRoleLabel } from "../../lib/auth";
import { AcademicYearsPanel } from "./academic-years-panel";
import { FinancePanel } from "./finance-panel";
import { JobsMonitorPanel } from "./jobs-monitor-panel";
import { PreRegistrationsPanel } from "./pre-registrations-panel";
import { StudentCardsPanel } from "./student-cards-panel";
import { ReenrollmentsPanel, StudentsPanel } from "./students-panel";

type DomainKey = "institutions" | "shifts" | "buses";
type StatusFilter = "active" | "inactive" | "all";
type SortField = "name" | "status" | "createdAt" | "updatedAt";
type RecordRow = BaseRecord | BusRecord;
type EditingRecord = RecordRow | null;
type PendingAction = {
  record: RecordRow;
  nextStatus: "ACTIVE" | "INACTIVE";
} | null;

const DOMAINS: Array<{
  key: DomainKey;
  label: string;
  singular: string;
  hasCapacity: boolean;
}> = [
  {
    key: "institutions",
    label: "Instituicoes",
    singular: "instituicao",
    hasCapacity: false,
  },
  { key: "shifts", label: "Turnos", singular: "turno", hasCapacity: false },
  { key: "buses", label: "Onibus", singular: "onibus", hasCapacity: true },
];
const DEFAULT_DOMAIN = DOMAINS[0]!;

export function AdminShell() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .me()
      .then((response) => {
        if (active) {
          setUser(response.user);
        }
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setAuthError("");

    try {
      await api.logout();
      router.replace("/login");
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : "Erro ao sair");
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <p className="text-sm text-slate-600">Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">
              Painel administrativo
            </p>
            <h1 className="text-xl font-semibold text-slate-950">Atretu</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-950">{user.name}</p>
              <p className="text-xs text-slate-500">
                {getPrimaryRoleLabel(user)}
              </p>
            </div>
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              onClick={handleLogout}
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-6">
        {!canAccessRestrictedAdmin(user) ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Seu perfil possui acesso operacional. Areas restritas do Super
            Admin permanecem bloqueadas.
          </div>
        ) : null}

        {authError ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {authError}
          </div>
        ) : null}

        <AdminWorkspace user={user} />
      </section>
    </main>
  );
}

function AdminWorkspace({ user }: { user: ApiUser }) {
  const [area, setArea] = useState<
    | "students"
    | "reenrollments"
    | "student-cards"
    | "finance"
    | "jobs"
    | "pre-registrations"
    | "years"
    | "base"
  >("students");
  const tabs = [
    { key: "students", label: "Academicos" },
    { key: "reenrollments", label: "Rematriculas" },
    { key: "student-cards", label: "Carteirinhas" },
    { key: "finance", label: "Financeiro" },
    { key: "jobs", label: "Monitor de Jobs", restricted: true },
    { key: "pre-registrations", label: "Pre-cadastros" },
    { key: "years", label: "Anos Letivos" },
    { key: "base", label: "Cadastros Base" },
  ] as const;
  const visibleTabs = tabs.filter(
    (tab) => !("restricted" in tab) || canAccessRestrictedAdmin(user),
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((tab) => (
          <button
            className={
              area === tab.key
                ? "rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                : "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            }
            key={tab.key}
            onClick={() => setArea(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {area === "students" ? <StudentsPanel user={user} /> : null}
      {area === "reenrollments" ? <ReenrollmentsPanel /> : null}
      {area === "student-cards" ? <StudentCardsPanel user={user} /> : null}
      {area === "finance" ? <FinancePanel user={user} /> : null}
      {area === "jobs" ? <JobsMonitorPanel /> : null}
      {area === "pre-registrations" ? <PreRegistrationsPanel /> : null}
      {area === "years" ? <AcademicYearsPanel user={user} /> : null}
      {area === "base" ? <BaseRecordsPanel /> : null}
    </div>
  );
}

function BaseRecordsPanel() {
  const [domain, setDomain] = useState<DomainKey>("institutions");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [selectedBus, setSelectedBus] = useState<BusRecord | null>(null);
  const [busAssignments, setBusAssignments] = useState<BusAssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [sort, setSort] = useState<SortField>("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editing, setEditing] = useState<EditingRecord>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const currentDomain = useMemo(
    () => DOMAINS.find((item) => item.key === domain) ?? DEFAULT_DOMAIN,
    [domain],
  );

  useEffect(() => {
    void loadYears();
  }, []);

  useEffect(() => {
    setEditing(null);
    setName("");
    setCapacity("");
    setSelectedBus(null);
    setBusAssignments([]);
    setPage(1);
    setMessage("");
    setError("");
  }, [domain]);

  useEffect(() => {
    void loadRecords();
  }, [domain, status, sort, order, page, academicYearId]);

  async function loadYears() {
    try {
      const response = await api.listAcademicYears({ status: "all" });
      setYears(response.data);
      const current = response.data.find((year) => year.isCurrent);
      if (current) {
        setAcademicYearId(current.id);
      }
    } catch {
      setYears([]);
    }
  }

  async function loadRecords(nextSearch = search) {
    setLoading(true);
    setError("");

    const params: ListRecordsParams = {
      page,
      limit: 10,
      search: nextSearch,
      status,
      sort,
      order,
      academicYearId: domain === "buses" ? academicYearId : undefined,
    };

    try {
      const response =
        domain === "institutions"
          ? await api.listInstitutions(params)
          : domain === "shifts"
            ? await api.listShifts(params)
            : await api.listBuses(params);

      setRecords(response.data);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
      if (selectedBus && domain === "buses") {
        const refreshed = response.data.find((record) => record.id === selectedBus.id);
        setSelectedBus(isBusRecord(refreshed) ? refreshed : null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar registros",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openBus(record: RecordRow) {
    if (!("capacity" in record)) {
      return;
    }
    setSelectedBus(record);
    setError("");
    try {
      const response = await api.listBusAssignments(record.id, {
        academicYearId,
        status: "active",
        limit: 100,
      });
      setBusAssignments(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Erro ao carregar vinculados",
      );
    }
  }

  function startEdit(record: RecordRow) {
    setEditing(record);
    setName(record.name);
    setCapacity("capacity" in record ? String(record.capacity) : "");
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setCapacity("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (currentDomain.hasCapacity) {
        const parsedCapacity = Number(capacity);
        if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
          throw new Error("Capacidade deve ser um numero inteiro maior que zero");
        }

        if (editing) {
          await api.updateBus(editing.id, { name, capacity: parsedCapacity });
        } else {
          await api.createBus({ name, capacity: parsedCapacity });
        }
      } else if (domain === "institutions") {
        if (editing) {
          await api.updateInstitution(editing.id, { name });
        } else {
          await api.createInstitution({ name });
        }
      } else if (editing) {
        await api.updateShift(editing.id, { name });
      } else {
        await api.createShift({ name });
      }

      setMessage(`${currentDomain.singular} salvo com sucesso`);
      resetForm();
      await loadRecords();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function confirmStatusChange() {
    if (!pendingAction) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { record, nextStatus } = pendingAction;
      if (domain === "institutions") {
        if (nextStatus === "ACTIVE") {
          await api.reactivateInstitution(record.id);
        } else {
          await api.inactivateInstitution(record.id);
        }
      } else if (domain === "shifts") {
        if (nextStatus === "ACTIVE") {
          await api.reactivateShift(record.id);
        } else {
          await api.inactivateShift(record.id);
        }
      } else if (nextStatus === "ACTIVE") {
        await api.reactivateBus(record.id);
      } else {
        await api.inactivateBus(record.id);
      }

      setMessage(
        nextStatus === "ACTIVE"
          ? `${currentDomain.singular} reativado`
          : `${currentDomain.singular} inativado`,
      );
      setPendingAction(null);
      await loadRecords();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao alterar status",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map((item) => (
            <button
              className={
                item.key === domain
                  ? "rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  : "rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              }
              key={item.key}
              onClick={() => setDomain(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            void loadRecords(search);
          }}
        >
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar"
            type="search"
            value={search}
          />
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            type="submit"
          >
            Buscar
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <form
          className="rounded border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={handleSubmit}
        >
          <h2 className="text-base font-semibold text-slate-950">
            {editing ? "Editar" : "Novo"} {currentDomain.singular}
          </h2>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Nome
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              maxLength={140}
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>

          {currentDomain.hasCapacity ? (
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Capacidade total
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                min={1}
                onChange={(event) => setCapacity(event.target.value)}
                required
                type="number"
                value={capacity}
              />
            </label>
          ) : null}

          <div className="mt-5 flex gap-2">
            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            {editing ? (
              <button
                className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                onClick={resetForm}
                type="button"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(1);
                }}
                value={status}
              >
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="all">Todos</option>
              </select>
              {currentDomain.hasCapacity ? (
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => {
                    setAcademicYearId(event.target.value);
                    setSelectedBus(null);
                    setBusAssignments([]);
                    setPage(1);
                  }}
                  value={academicYearId}
                >
                  <option value="">Ano Letivo</option>
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.isCurrent ? `${year.year} atual` : year.year}
                    </option>
                  ))}
                </select>
              ) : null}
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setSort(event.target.value as SortField)}
                value={sort}
              >
                <option value="name">Nome</option>
                <option value="status">Status</option>
                <option value="createdAt">Criacao</option>
                <option value="updatedAt">Atualizacao</option>
              </select>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) =>
                  setOrder(event.target.value as "asc" | "desc")
                }
                value={order}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <button
                className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                type="button"
              >
                Anterior
              </button>
              <span>
                {page}/{totalPages}
              </span>
              <button
                className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(current + 1, totalPages))
                }
                type="button"
              >
                Proxima
              </button>
            </div>
          </div>

          {message ? (
            <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  {currentDomain.hasCapacity ? (
                    <th className="px-4 py-3 font-semibold">Capacidade</th>
                  ) : null}
                  {currentDomain.hasCapacity ? (
                    <>
                      <th className="px-4 py-3 font-semibold">Ocupados</th>
                      <th className="px-4 py-3 font-semibold">Disponiveis</th>
                    </>
                  ) : null}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Atualizado</th>
                  <th className="px-4 py-3 font-semibold">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={5}>
                      Carregando...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={5}>
                      Nenhum registro encontrado
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {record.name}
                      </td>
                      {currentDomain.hasCapacity ? (
                        <td className="px-4 py-3 text-slate-700">
                          {"capacity" in record ? record.capacity : ""}
                        </td>
                      ) : null}
                      {currentDomain.hasCapacity ? (
                        <>
                          <td className="px-4 py-3 text-slate-700">
                            {"occupiedSeats" in record ? record.occupiedSeats ?? 0 : ""}
                          </td>
                          <td className="px-4 py-3">
                            {"availableSeats" in record ? (
                              <span
                                className={
                                  record.isFull
                                    ? "rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                                    : "rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                                }
                              >
                                {record.availableSeats ?? record.capacity}
                              </span>
                            ) : null}
                          </td>
                        </>
                      ) : null}
                      <td className="px-4 py-3">
                        <span
                          className={
                            record.status === "ACTIVE"
                              ? "rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                              : "rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                          }
                        >
                          {record.status === "ACTIVE" ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(record.updatedAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                            onClick={() => startEdit(record)}
                            type="button"
                          >
                            Editar
                          </button>
                          {currentDomain.hasCapacity ? (
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                              onClick={() => void openBus(record)}
                              type="button"
                            >
                              Vinculados
                            </button>
                          ) : null}
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                            onClick={() =>
                              setPendingAction({
                                record,
                                nextStatus:
                                  record.status === "ACTIVE"
                                    ? "INACTIVE"
                                    : "ACTIVE",
                              })
                            }
                            type="button"
                          >
                            {record.status === "ACTIVE"
                              ? "Inativar"
                              : "Reativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedBus ? (
        <div className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {selectedBus.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Capacidade {selectedBus.capacity} / Ocupados{" "}
                {selectedBus.occupiedSeats ?? 0} / Disponiveis{" "}
                {selectedBus.availableSeats ?? selectedBus.capacity}
              </p>
            </div>
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              onClick={() => {
                setSelectedBus(null);
                setBusAssignments([]);
              }}
              type="button"
            >
              Fechar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Academico</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Instituicao</th>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3">Serie</th>
                  <th className="px-4 py-3">Entrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {busAssignments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={6}>
                      Nenhum academico vinculado neste Ano Letivo
                    </td>
                  </tr>
                ) : (
                  busAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {assignment.student.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.student.cpfMasked}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.enrollment.institution.name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.enrollment.course}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {assignment.enrollment.grade}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(assignment.startedAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded border border-slate-200 bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold text-slate-950">
              Confirmar alteracao
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pendingAction.nextStatus === "ACTIVE"
                ? "Reativar"
                : "Inativar"}{" "}
              {pendingAction.record.name}?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                onClick={() => setPendingAction(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={saving}
                onClick={confirmStatusChange}
                type="button"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isBusRecord(record: RecordRow | undefined): record is BusRecord {
  return Boolean(record && "capacity" in record && typeof record.capacity === "number");
}
