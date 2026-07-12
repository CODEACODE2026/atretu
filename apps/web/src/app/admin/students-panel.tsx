"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  api,
  type AcademicYear,
  type ApiUser,
  type BaseRecord,
  type BusAssignmentRecord,
  type BusRecord,
  type EnrollmentRecord,
  type StudentHistoryEvent,
  type StudentDocumentRecord,
  type StudentDocumentType,
  type StudentDetail,
  type StudentPayload,
  type ReenrollmentPreview,
  type StudentSummary,
} from "../../lib/api";
import { StudentInvoicesForStudent } from "./finance-panel";
import { StudentCardsForStudent } from "./student-cards-panel";

const emptyPerson: StudentPayload["person"] = {
  fullName: "",
  cpf: "",
  rg: "",
  birthDate: "",
  phone: "",
  email: "",
  addressStreet: "",
  addressNumber: "",
  addressNeighborhood: "",
  addressCity: "",
  addressZipCode: "",
  addressState: "",
  addressComplement: "",
};

const emptyEnrollment: StudentPayload["enrollment"] = {
  academicYearId: "",
  institutionId: "",
  shiftId: "",
  course: "",
  grade: "",
};

export function StudentsPanel({ user }: { user: ApiUser }) {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [shifts, setShifts] = useState<BaseRecord[]>([]);
  const [selected, setSelected] = useState<StudentDetail | null>(null);
  const [person, setPerson] = useState<StudentPayload["person"]>(emptyPerson);
  const [guardian, setGuardian] = useState<StudentPayload["guardian"]>();
  const [enrollment, setEnrollment] =
    useState<StudentPayload["enrollment"]>(emptyEnrollment);
  const [search, setSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "suspended" | "terminated" | "all"
  >("active");
  const [history, setHistory] = useState<StudentHistoryEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [page, academicYearId, institutionId, shiftId, statusFilter]);

  async function loadReferences() {
    setError("");
    try {
      const [yearsResponse, institutionsResponse, shiftsResponse] =
        await Promise.all([
          api.listAcademicYears(),
          api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
          api.listShifts({ status: "active", limit: 100, sort: "name" }),
        ]);
      setYears(yearsResponse.data);
      setInstitutions(institutionsResponse.data);
      setShifts(shiftsResponse.data);
      const currentYear = yearsResponse.data.find((year) => year.isCurrent);
      if (currentYear) {
        setEnrollment((current) => ({
          ...current,
          academicYearId: current.academicYearId || currentYear.id,
        }));
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar referencias",
      );
    }
  }

  async function loadStudents(nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const response = await api.listStudents({
        page,
        limit: 10,
        search: nextSearch,
        academicYearId,
        institutionId,
        shiftId,
        status: statusFilter,
      });
      setStudents(response.data);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function openStudent(id: string) {
    setError("");
    try {
      const detail = await api.getStudent(id);
      const historyResponse = await api.listStudentHistory(id);
      setSelected(detail);
      setHistory(historyResponse.data);
      setPerson({
        fullName: detail.person.fullName,
        cpf: detail.person.cpf,
        rg: detail.person.rg ?? "",
        birthDate: formatDateInput(detail.person.birthDate),
        phone: detail.person.phone ?? "",
        email: detail.person.email ?? "",
        addressStreet: detail.person.addressStreet,
        addressNumber: detail.person.addressNumber,
        addressNeighborhood: detail.person.addressNeighborhood,
        addressCity: detail.person.addressCity,
        addressZipCode: detail.person.addressZipCode ?? "",
        addressState: detail.person.addressState ?? "",
        addressComplement: detail.person.addressComplement ?? "",
      });
      setGuardian(
        detail.guardian
          ? {
              fullName: detail.guardian.fullName,
              cpf: detail.guardian.cpf ?? "",
              rg: detail.guardian.rg ?? "",
            }
          : undefined,
      );
      const currentEnrollment = detail.enrollments[0];
      if (currentEnrollment) {
        setEnrollment(toEnrollmentPayload(currentEnrollment));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir");
    }
  }

  function resetForm() {
    setSelected(null);
    setHistory([]);
    setPerson(emptyPerson);
    setGuardian(undefined);
    setEnrollment(emptyEnrollment);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
      setError("");
    try {
      await api.createStudent({
        person: cleanPerson(person),
        guardian: guardian?.fullName ? guardian : undefined,
        enrollment,
      });
      setMessage("Academico criado");
      resetForm();
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePerson() {
    if (!selected) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const detail = await api.updateStudentPerson(selected.id, cleanPerson(person));
      setSelected(detail);
      setMessage("Dados pessoais atualizados");
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateGuardian() {
    if (!selected) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const detail = await api.updateStudentGuardian(
        selected.id,
        guardian?.fullName
          ? { guardian }
          : { clear: true },
      );
      setSelected(detail);
      setMessage("Responsavel atualizado");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEnrollment() {
    if (!selected || selected.enrollments.length === 0) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const currentEnrollment = selected.enrollments[0]!;
      await api.updateEnrollment(selected.id, currentEnrollment.id, enrollment);
      const detail = await api.getStudent(selected.id);
      setSelected(detail);
      setMessage("Matricula atualizada");
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function refreshSelected(studentId = selected?.id) {
    if (!studentId) {
      return;
    }
    const [detail, historyResponse] = await Promise.all([
      api.getStudent(studentId),
      api.listStudentHistory(studentId),
    ]);
    setSelected(detail);
    setHistory(historyResponse.data);
    await loadStudents();
  }

  async function handleSuspend() {
    if (!selected) {
      return;
    }
    const reason = window.prompt("Motivo: NON_PAYMENT, INFRACTION ou OTHER");
    if (
      reason !== "NON_PAYMENT" &&
      reason !== "INFRACTION" &&
      reason !== "OTHER"
    ) {
      setError("Motivo de suspensao invalido");
      return;
    }
    const justification = window.prompt("Justificativa obrigatoria");
    if (!justification || justification.trim().length < 3) {
      setError("Justificativa obrigatoria");
      return;
    }
    const releaseBusSeat = window.confirm(
      "Deseja liberar a vaga do onibus deste academico? OK libera; Cancelar mantem a vaga ocupada.",
    );
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.suspendStudent(selected.id, {
        reason,
        justification: justification.trim(),
        releaseBusSeat,
      });
      setMessage("Academico suspenso");
      await refreshSelected(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao suspender");
    } finally {
      setSaving(false);
    }
  }

  async function handleReactivate() {
    if (!selected) {
      return;
    }
    const lastSuspension = history.find(
      (item) => item.eventType === "STUDENT_SUSPENDED",
    );
    let busId: string | undefined;
    if (lastSuspension?.busSeatReleased) {
      const enrollment = selected.enrollments[0];
      if (!enrollment) {
        setError("Matricula obrigatoria para reativar");
        return;
      }
      const busesResponse = await api.listBuses({
        status: "active",
        limit: 100,
        sort: "name",
        academicYearId: enrollment.academicYear.id,
      });
      const available = busesResponse.data.filter((bus) => !bus.isFull);
      const choice = window.prompt(
        `Informe o numero do onibus para reativar:\n${available
          .map(
            (bus, index) =>
              `${index + 1}. ${bus.name} (${bus.availableSeats ?? bus.capacity} vagas)`,
          )
          .join("\n")}`,
      );
      const index = Number(choice) - 1;
      busId = available[index]?.id;
      if (!busId) {
        setError("Onibus ativo com vaga obrigatorio");
        return;
      }
    } else if (
      !window.confirm("Reativar academico mantendo o vinculo atual de onibus?")
    ) {
      return;
    }
    const note = window.prompt("Observacao opcional") ?? undefined;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.reactivateStudent(selected.id, {
        busId,
        note: emptyToUndefined(note),
      });
      setMessage("Academico reativado");
      await refreshSelected(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao reativar");
    } finally {
      setSaving(false);
    }
  }

  async function handleTerminate() {
    if (!selected) {
      return;
    }
    const terminationReason = window.prompt("Tipo: WITHDRAWAL ou NON_PAYMENT");
    if (terminationReason !== "WITHDRAWAL" && terminationReason !== "NON_PAYMENT") {
      setError("Tipo de desligamento invalido");
      return;
    }
    const justification = window.prompt("Justificativa obrigatoria");
    if (!justification || justification.trim().length < 3) {
      setError("Justificativa obrigatoria");
      return;
    }
    const confirmed = window.confirm(
      "O desligamento preserva o historico, libera a vaga e encerra diretoria ativa se existir. Confirmar?",
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.terminateStudent(selected.id, {
        terminationReason,
        justification: justification.trim(),
      });
      setMessage("Academico desligado");
      await refreshSelected(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao desligar");
    } finally {
      setSaving(false);
    }
  }

  async function handleStartBoard() {
    if (!selected) {
      return;
    }
    if (!window.confirm("Adicionar este academico a diretoria?")) {
      return;
    }
    const note = window.prompt("Observacao opcional") ?? undefined;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.startBoardMembership(selected.id, { note: emptyToUndefined(note) });
      setMessage("Diretoria ativada");
      await refreshSelected(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro na diretoria");
    } finally {
      setSaving(false);
    }
  }

  async function handleEndBoard() {
    if (!selected?.activeBoardMembership) {
      return;
    }
    if (!window.confirm("Inativar participacao na diretoria?")) {
      return;
    }
    const note = window.prompt("Observacao opcional") ?? undefined;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.endBoardMembership(selected.id, selected.activeBoardMembership.id, {
        note: emptyToUndefined(note),
      });
      setMessage("Diretoria inativada");
      await refreshSelected(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro na diretoria");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            void loadStudents(search);
          }}
        >
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou CPF"
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

        <div className="flex flex-wrap gap-2">
          <Select
            label="Ano"
            onChange={(value) => {
              setAcademicYearId(value);
              setPage(1);
            }}
            options={years.map((year) => ({
              label: String(year.year),
              value: year.id,
            }))}
            value={academicYearId}
          />
          <Select
            label="Instituicao"
            onChange={(value) => {
              setInstitutionId(value);
              setPage(1);
            }}
            options={institutions.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            value={institutionId}
          />
          <Select
            label="Turno"
            onChange={(value) => {
              setShiftId(value);
              setPage(1);
            }}
            options={shifts.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            value={shiftId}
          />
          <Select
            label="Situacao"
            onChange={(value) => {
              setStatusFilter(
                (value || "active") as
                  | "active"
                  | "suspended"
                  | "terminated"
                  | "all",
              );
              setPage(1);
            }}
            options={[
              { label: "Ativos", value: "active" },
              { label: "Suspensos", value: "suspended" },
              { label: "Desligados", value: "terminated" },
              { label: "Todos", value: "all" },
            ]}
            value={statusFilter}
          />
        </div>
      </div>

      {message ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Instituicao</th>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3">Serie</th>
                  <th className="px-4 py-3">Turno</th>
                  <th className="px-4 py-3">Ano</th>
                  <th className="px-4 py-3">Situacao</th>
                  <th className="px-4 py-3">Diretoria</th>
                  <th className="px-4 py-3">Fatura futura</th>
                  <th className="px-4 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={11}>
                      Carregando...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={11}>
                      Nenhum academico encontrado
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {student.person.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.person.cpfMasked}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.currentEnrollment?.institution.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.currentEnrollment?.course ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.currentEnrollment?.grade ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.currentEnrollment?.shift.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.currentEnrollment?.academicYear.year ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={student.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.activeBoardMembership ? "Ativa" : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {student.canReceiveFutureInvoices ? "Elegivel" : "Nao"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                          onClick={() => void openStudent(student.id)}
                          type="button"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4 text-sm text-slate-600">
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
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              type="button"
            >
              Proxima
            </button>
          </div>
        </div>

        <form
          className="rounded border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={handleCreate}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">
              {selected ? "Ficha do academico" : "Novo academico"}
            </h2>
            {selected ? (
              <button
                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                onClick={resetForm}
                type="button"
              >
                Novo
              </button>
            ) : null}
          </div>

          {selected ? (
            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-slate-950">Situacao:</span>{" "}
                  {statusLabel(selected.status)}
                </p>
                <p>
                  <span className="font-medium text-slate-950">Diretoria:</span>{" "}
                  {selected.activeBoardMembership ? "Ativa" : "Inativa"}
                </p>
                <p>
                  <span className="font-medium text-slate-950">
                    Fatura futura:
                  </span>{" "}
                  {selected.canReceiveFutureInvoices ? "Elegivel" : "Nao elegivel"}
                </p>
                <p>
                  <span className="font-medium text-slate-950">Onibus:</span>{" "}
                  consulte a matricula abaixo
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-700 disabled:opacity-50"
                  disabled={saving || selected.status !== "ACTIVE"}
                  onClick={() => void handleSuspend()}
                  type="button"
                >
                  Suspender
                </button>
                <button
                  className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
                  disabled={saving || selected.status !== "SUSPENDED"}
                  onClick={() => void handleReactivate()}
                  type="button"
                >
                  Reativar
                </button>
                <button
                  className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-50"
                  disabled={saving || selected.status === "TERMINATED"}
                  onClick={() => void handleTerminate()}
                  type="button"
                >
                  Desligar
                </button>
                {selected.activeBoardMembership ? (
                  <button
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void handleEndBoard()}
                    type="button"
                  >
                    Inativar diretoria
                  </button>
                ) : (
                  <button
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                    disabled={saving || selected.status !== "ACTIVE"}
                    onClick={() => void handleStartBoard()}
                    type="button"
                  >
                    Adicionar diretoria
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <PersonFields person={person} setPerson={setPerson} />
          <GuardianFields guardian={guardian} setGuardian={setGuardian} />
          <EnrollmentFields
            enrollment={enrollment}
            institutions={institutions}
            setEnrollment={setEnrollment}
            shifts={shifts}
            years={years}
          />

          {selected ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={saving}
                onClick={() => void handleUpdatePerson()}
                type="button"
              >
                Salvar dados
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={saving}
                onClick={() => void handleUpdateGuardian()}
                type="button"
              >
                Salvar responsavel
              </button>
              <button
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={saving}
                onClick={() => void handleUpdateEnrollment()}
                type="button"
              >
                Salvar matricula
              </button>
            </div>
          ) : (
            <button
              className="mt-5 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Salvando..." : "Criar academico"}
            </button>
          )}

          {selected ? (
            <>
              <StudentEnrollments
                enrollments={selected.enrollments}
                onChanged={async () => {
                  const detail = await api.getStudent(selected.id);
                  setSelected(detail);
                  await loadStudents();
                }}
              />
              <StudentCardsForStudent
                student={selected}
                onChanged={async () => {
                  await refreshSelected(selected.id);
                }}
              />
              <StudentInvoicesForStudent
                student={selected}
                user={user}
                onChanged={async () => {
                  await refreshSelected(selected.id);
                }}
              />
              <StudentDocuments studentId={selected.id} />
              <StudentHistory events={history} />
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export function ReenrollmentsPanel() {
  const [candidates, setCandidates] = useState<StudentSummary[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [shifts, setShifts] = useState<BaseRecord[]>([]);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [preview, setPreview] = useState<ReenrollmentPreview | null>(null);
  const [enrollment, setEnrollment] =
    useState<StudentPayload["enrollment"]>(emptyEnrollment);
  const [busId, setBusId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    if (academicYearId) {
      void loadCandidates();
      void loadBuses();
      setEnrollment((current) => ({ ...current, academicYearId }));
    }
  }, [academicYearId]);

  async function loadReferences() {
    setError("");
    try {
      const [yearsResponse, institutionsResponse, shiftsResponse] =
        await Promise.all([
          api.listAcademicYears(),
          api.listInstitutions({ status: "active", limit: 100, sort: "name" }),
          api.listShifts({ status: "active", limit: 100, sort: "name" }),
        ]);
      setYears(yearsResponse.data);
      setInstitutions(institutionsResponse.data);
      setShifts(shiftsResponse.data);
      const target = yearsResponse.data.find((year) => year.isCurrent);
      setAcademicYearId(target?.id ?? yearsResponse.data[0]?.id ?? "");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar referencias",
      );
    }
  }

  async function loadCandidates(nextSearch = search) {
    if (!academicYearId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await api.listReenrollmentCandidates({
        academicYearId,
        search: nextSearch,
        limit: 20,
      });
      setCandidates(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar candidatos",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadBuses() {
    if (!academicYearId) {
      return;
    }
    try {
      const response = await api.listBuses({
        status: "active",
        limit: 100,
        sort: "name",
        academicYearId,
      });
      setBuses(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar onibus");
    }
  }

  async function selectCandidate(candidate: StudentSummary) {
    setSelected(candidate);
    setMessage("");
    setError("");
    setBusId("");
    setNote("");
    try {
      const nextPreview = await api.previewReenrollment(candidate.id, academicYearId);
      setPreview(nextPreview);
      setEnrollment({
        academicYearId,
        institutionId: nextPreview.previousEnrollment?.institution.id ?? "",
        shiftId: nextPreview.previousEnrollment?.shift.id ?? "",
        course: nextPreview.previousEnrollment?.course ?? "",
        grade: nextPreview.previousEnrollment?.grade ?? "",
      });
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : "Erro ao abrir preview");
    }
  }

  async function handleReenroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !preview?.eligible) {
      setError(preview?.blockingReason ?? "Selecione um academico elegivel");
      return;
    }
    const confirmed = window.confirm(
      "Confirmar rematricula preservando a matricula anterior? A selecao de onibus e opcional e nao gera boleto, carteirinha ou copia de documentos.",
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.reenrollStudent(selected.id, {
        ...enrollment,
        busId: emptyToUndefined(busId),
        note: emptyToUndefined(note),
      });
      setMessage("Rematricula criada");
      setSelected(null);
      setPreview(null);
      setBusId("");
      setNote("");
      setEnrollment({ ...emptyEnrollment, academicYearId });
      await loadCandidates();
      await loadBuses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao rematricular");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <form
              className="flex min-w-[260px] flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void loadCandidates(search);
              }}
            >
              <input
                className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar candidato"
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
            <Select
              label="Ano de destino"
              onChange={(value) => {
                setAcademicYearId(value);
                setSelected(null);
                setPreview(null);
              }}
              options={years.map((year) => ({
                label: year.isCurrent ? `${year.year} atual` : String(year.year),
                value: year.id,
              }))}
              value={academicYearId}
            />
          </div>
        </div>

        {message ? (
          <div className="mx-4 mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mx-4 mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Academico</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Ano anterior</th>
                <th className="px-4 py-3">Instituicao</th>
                <th className="px-4 py-3">Curso</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Nenhum candidato elegivel
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {candidate.person.fullName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.person.cpfMasked}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.currentEnrollment?.academicYear.year ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.currentEnrollment?.institution.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.currentEnrollment?.course ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                        onClick={() => void selectCandidate(candidate)}
                        type="button"
                      >
                        Preparar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form
        className="rounded border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleReenroll}
      >
        <h2 className="text-base font-semibold text-slate-950">
          Nova rematricula
        </h2>

        {selected && preview ? (
          <div className="mt-4 grid gap-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-950">
                {selected.person.fullName}
              </p>
              <p className="mt-1 text-slate-600">
                Matricula anterior preservada:{" "}
                {preview.previousEnrollment
                  ? `${preview.previousEnrollment.academicYear.year} - ${preview.previousEnrollment.institution.name}`
                  : "sem matricula anterior"}
              </p>
              <p className="mt-1 text-slate-600">
                Onibus anterior:{" "}
                {preview.previousBusAssignment?.bus.name ?? "sem referencia"}
              </p>
              <p className="mt-1 text-slate-600">
                Esta rematricula nao gera boleto, carteirinha ou copia documentos.
              </p>
              {preview.blockingReason ? (
                <p className="mt-2 text-red-700">{preview.blockingReason}</p>
              ) : null}
            </div>

            <EnrollmentFields
              enrollment={enrollment}
              institutions={institutions}
              setEnrollment={setEnrollment}
              shifts={shifts}
              title="Nova matricula anual"
              years={years}
            />

            <div className="grid gap-2">
              <h3 className="text-sm font-semibold text-slate-950">
                Onibus opcional
              </h3>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setBusId(event.target.value)}
                value={busId}
              >
                <option value="">Sem onibus nesta rematricula</option>
                {buses.map((bus) => (
                  <option disabled={Boolean(bus.isFull)} key={bus.id} value={bus.id}>
                    {bus.name} - {bus.availableSeats ?? bus.capacity} vagas
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                maxLength={240}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Observacao opcional"
                value={note}
              />
            </div>

            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={saving || !preview.eligible}
              type="submit"
            >
              {saving ? "Criando..." : "Confirmar rematricula"}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Selecione um candidato elegivel para preparar a nova Enrollment.
          </p>
        )}
      </form>
    </div>
  );
}

function PersonFields({
  person,
  setPerson,
}: {
  person: StudentPayload["person"];
  setPerson: (person: StudentPayload["person"]) => void;
}) {
  function update(key: keyof StudentPayload["person"], value: string) {
    setPerson({ ...person, [key]: value });
  }

  return (
    <div className="mt-4 grid gap-3">
      <h3 className="text-sm font-semibold text-slate-950">Dados pessoais</h3>
      <Field label="Nome completo" onChange={(value) => update("fullName", value)} required value={person.fullName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CPF" onChange={(value) => update("cpf", value)} required value={person.cpf} />
        <Field label="RG" onChange={(value) => update("rg", value)} value={person.rg ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nascimento" onChange={(value) => update("birthDate", value)} required type="date" value={person.birthDate} />
        <Field label="Telefone" onChange={(value) => update("phone", value)} value={person.phone ?? ""} />
      </div>
      <Field label="E-mail" onChange={(value) => update("email", value)} type="email" value={person.email ?? ""} />
      <h3 className="pt-2 text-sm font-semibold text-slate-950">Endereco</h3>
      <Field label="Logradouro" onChange={(value) => update("addressStreet", value)} required value={person.addressStreet} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Numero" onChange={(value) => update("addressNumber", value)} required value={person.addressNumber} />
        <Field label="Bairro" onChange={(value) => update("addressNeighborhood", value)} required value={person.addressNeighborhood} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cidade" onChange={(value) => update("addressCity", value)} required value={person.addressCity} />
        <Field label="UF" maxLength={2} onChange={(value) => update("addressState", value)} value={person.addressState ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CEP" onChange={(value) => update("addressZipCode", value)} value={person.addressZipCode ?? ""} />
        <Field label="Complemento" onChange={(value) => update("addressComplement", value)} value={person.addressComplement ?? ""} />
      </div>
    </div>
  );
}

function GuardianFields({
  guardian,
  setGuardian,
}: {
  guardian?: StudentPayload["guardian"];
  setGuardian: (guardian?: StudentPayload["guardian"]) => void;
}) {
  const current = guardian ?? { fullName: "", cpf: "", rg: "" };
  function update(key: keyof NonNullable<StudentPayload["guardian"]>, value: string) {
    setGuardian({ ...current, [key]: value });
  }

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">Responsavel</h3>
        <button
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
          onClick={() => setGuardian(undefined)}
          type="button"
        >
          Limpar
        </button>
      </div>
      <Field label="Nome completo" onChange={(value) => update("fullName", value)} value={current.fullName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CPF" onChange={(value) => update("cpf", value)} value={current.cpf ?? ""} />
        <Field label="RG" onChange={(value) => update("rg", value)} value={current.rg ?? ""} />
      </div>
    </div>
  );
}

function EnrollmentFields({
  enrollment,
  institutions,
  setEnrollment,
  shifts,
  title = "Matricula inicial",
  years,
}: {
  enrollment: StudentPayload["enrollment"];
  institutions: BaseRecord[];
  setEnrollment: (enrollment: StudentPayload["enrollment"]) => void;
  shifts: BaseRecord[];
  title?: string;
  years: AcademicYear[];
}) {
  function update(key: keyof StudentPayload["enrollment"], value: string) {
    setEnrollment({ ...enrollment, [key]: value });
  }

  return (
    <div className="mt-4 grid gap-3">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledSelect
          label="Ano Letivo"
          onChange={(value) => update("academicYearId", value)}
          options={years.map((year) => ({
            label: year.isCurrent ? `${year.year} atual` : String(year.year),
            value: year.id,
          }))}
          required
          value={enrollment.academicYearId}
        />
        <LabeledSelect
          label="Instituicao"
          onChange={(value) => update("institutionId", value)}
          options={institutions.map((item) => ({ label: item.name, value: item.id }))}
          required
          value={enrollment.institutionId}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Curso" onChange={(value) => update("course", value)} required value={enrollment.course} />
        <Field label="Serie" onChange={(value) => update("grade", value)} required value={enrollment.grade} />
      </div>
      <LabeledSelect
        label="Turno"
        onChange={(value) => update("shiftId", value)}
        options={shifts.map((item) => ({ label: item.name, value: item.id }))}
        required
        value={enrollment.shiftId}
      />
    </div>
  );
}

function StudentEnrollments({
  enrollments,
  onChanged,
}: {
  enrollments: EnrollmentRecord[];
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-950">Matriculas</h3>
      <div className="mt-2 grid gap-2">
        {enrollments.map((item) => (
          <div className="rounded border border-slate-200 p-3 text-sm" key={item.id}>
            <p className="font-medium text-slate-950">
              {item.academicYear.year} - {item.institution.name}
            </p>
            <p className="mt-1 text-slate-600">
              {item.course} / Serie {item.grade} / {item.shift.name}
            </p>
            <BusAssignmentControls enrollment={item} onChanged={onChanged} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BusAssignmentControls({
  enrollment,
  onChanged,
}: {
  enrollment: EnrollmentRecord;
  onChanged: () => Promise<void>;
}) {
  const [assignment, setAssignment] = useState<BusAssignmentRecord | null>(null);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [busId, setBusId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadBusState();
  }, [enrollment.id]);

  async function loadBusState() {
    setError("");
    try {
      const [current, busResponse] = await Promise.all([
        api.getCurrentBusAssignment(enrollment.id),
        api.listBuses({
          status: "active",
          limit: 100,
          sort: "name",
          academicYearId: enrollment.academicYear.id,
        }),
      ]);
      setAssignment(current);
      setBuses(busResponse.data);
      setBusId(current?.bus.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar onibus");
    }
  }

  async function handleAssignOrSwitch() {
    if (!busId) {
      setError("Selecione um onibus");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (assignment) {
        if (assignment.bus.id === busId) {
          throw new Error("Selecione um onibus diferente para troca");
        }
        const confirmed = window.confirm(
          "Esta troca vai liberar a vaga no onibus anterior e ocupar uma vaga no novo onibus.",
        );
        if (!confirmed) {
          return;
        }
        await api.switchBus(enrollment.id, {
          newBusId: busId,
          note: emptyToUndefined(note),
        });
        setMessage("Onibus trocado");
      } else {
        await api.assignBus(enrollment.id, {
          busId,
          note: emptyToUndefined(note),
        });
        setMessage("Onibus vinculado");
      }
      setNote("");
      await loadBusState();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao salvar onibus");
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease() {
    if (!assignment) {
      return;
    }
    const confirmed = window.confirm("Liberar a vaga deste onibus?");
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.releaseBus(enrollment.id, { note: emptyToUndefined(note) });
      setMessage("Vaga liberada");
      setNote("");
      await loadBusState();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao liberar vaga");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-950">
          Onibus atual: {assignment?.bus.name ?? "sem vinculo"}
        </p>
        {assignment ? (
          <button
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
            disabled={saving}
            onClick={() => void handleRelease()}
            type="button"
          >
            Liberar vaga
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          onChange={(event) => setBusId(event.target.value)}
          value={busId}
        >
          <option value="">Selecionar onibus</option>
          {buses.map((bus) => (
            <option
              disabled={Boolean(bus.isFull) && bus.id !== assignment?.bus.id}
              key={bus.id}
              value={bus.id}
            >
              {bus.name} - {bus.availableSeats ?? bus.capacity} vagas
            </option>
          ))}
        </select>
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          maxLength={240}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Observacao opcional"
          value={note}
        />
      </div>
      <button
        className="mt-2 rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        disabled={saving}
        onClick={() => void handleAssignOrSwitch()}
        type="button"
      >
        {assignment ? "Trocar onibus" : "Vincular onibus"}
      </button>
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

const documentTypes: Array<{ label: string; value: StudentDocumentType }> = [
  { label: "CPF", value: "CPF" },
  { label: "RG", value: "RG" },
  { label: "Comprovante de residencia", value: "PROOF_OF_ADDRESS" },
  { label: "Comprovante de matricula", value: "PROOF_OF_ENROLLMENT" },
];

function StudentDocuments({ studentId }: { studentId: string }) {
  const [documents, setDocuments] = useState<StudentDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<StudentDocumentType | "download" | "remove" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadDocuments();
  }, [studentId]);

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listStudentDocuments(studentId, { status: "all" });
      setDocuments(response.data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar documentos",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(
    documentType: StudentDocumentType,
    file: File | undefined,
    activeDocument?: StudentDocumentRecord,
  ) {
    if (!file) {
      return;
    }
    if (activeDocument) {
      const confirmed = window.confirm("Substituir o documento ativo?");
      if (!confirmed) {
        return;
      }
    }
    setBusyType(documentType);
    setMessage("");
    setError("");
    try {
      if (activeDocument) {
        await api.replaceStudentDocument(studentId, activeDocument.id, file);
        setMessage("Documento substituido");
      } else {
        await api.uploadStudentDocument(studentId, documentType, file);
        setMessage("Documento enviado");
      }
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao enviar arquivo");
    } finally {
      setBusyType("");
    }
  }

  async function handleDownload(
    studentDocument: StudentDocumentRecord,
    disposition: "attachment" | "inline",
  ) {
    setBusyType("download");
    setMessage("");
    setError("");
    try {
      const { blob, fileName } = await api.downloadStudentDocument(
        studentId,
        studentDocument.id,
        disposition,
      );
      const objectUrl = URL.createObjectURL(blob);
      if (disposition === "inline") {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao baixar documento");
    } finally {
      setBusyType("");
    }
  }

  async function handleRemove(document: StudentDocumentRecord) {
    const confirmed = window.confirm("Remover logicamente este documento?");
    if (!confirmed) {
      return;
    }
    setBusyType("remove");
    setMessage("");
    setError("");
    try {
      await api.removeStudentDocument(studentId, document.id);
      setMessage("Documento removido");
      await loadDocuments();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao remover documento");
    } finally {
      setBusyType("");
    }
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">Documentos</h3>
        <button
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
          disabled={loading}
          onClick={() => void loadDocuments()}
          type="button"
        >
          Atualizar
        </button>
      </div>

      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}

      <div className="mt-3 grid gap-3">
        {loading ? (
          <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">
            Carregando documentos...
          </p>
        ) : (
          documentTypes.map((item) => {
            const activeDocument = documents.find(
              (document) =>
                document.documentType === item.value &&
                document.status === "ACTIVE",
            );
            const history = documents.filter(
              (document) =>
                document.documentType === item.value &&
                document.status !== "ACTIVE",
            );
            return (
              <div className="rounded border border-slate-200 p-3" key={item.value}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeDocument
                        ? `${activeDocument.extension.toUpperCase()} - ${formatBytes(
                            activeDocument.sizeBytes,
                          )} - enviado em ${formatDateTime(
                            activeDocument.createdAt,
                          )}`
                        : "Documento ausente"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      activeDocument
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {activeDocument ? "Ativo" : "Ausente"}
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  <input
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="block w-full text-xs text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                    disabled={busyType === item.value}
                    onChange={(event) => {
                      void handleFile(
                        item.value,
                        event.target.files?.[0],
                        activeDocument,
                      );
                      event.target.value = "";
                    }}
                    type="file"
                  />
                  {activeDocument ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                        disabled={busyType !== ""}
                        onClick={() => void handleDownload(activeDocument, "inline")}
                        type="button"
                      >
                        Visualizar
                      </button>
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                        disabled={busyType !== ""}
                        onClick={() =>
                          void handleDownload(activeDocument, "attachment")
                        }
                        type="button"
                      >
                        Baixar
                      </button>
                      <button
                        className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                        disabled={busyType !== ""}
                        onClick={() => void handleRemove(activeDocument)}
                        type="button"
                      >
                        Remover
                      </button>
                    </div>
                  ) : null}
                </div>

                {history.length > 0 ? (
                  <details className="mt-3 text-xs text-slate-600">
                    <summary className="cursor-pointer font-medium">
                      Historico
                    </summary>
                    <div className="mt-2 grid gap-1">
                      {history.map((document) => (
                        <p key={document.id}>
                          {document.status} - {document.extension.toUpperCase()} -{" "}
                          {formatDateTime(document.updatedAt)}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StudentHistory({ events }: { events: StudentHistoryEvent[] }) {
  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-950">
        Historico funcional
      </h3>
      <div className="mt-3 grid gap-2">
        {events.length === 0 ? (
          <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">
            Nenhum evento funcional registrado
          </p>
        ) : (
          events.map((event) => (
            <div className="rounded border border-slate-200 p-3 text-sm" key={event.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-950">
                  {historyEventLabel(event.eventType)}
                </p>
                <span className="text-xs text-slate-500">
                  {formatDateTime(event.occurredAt)}
                </span>
              </div>
              <div className="mt-1 grid gap-1 text-xs text-slate-600">
                {event.suspensionReason ? (
                  <p>Motivo: {reasonLabel(event.suspensionReason)}</p>
                ) : null}
                {event.terminationReason ? (
                  <p>Tipo: {terminationLabel(event.terminationReason)}</p>
                ) : null}
                {event.justification ? <p>Observacao: {event.justification}</p> : null}
                {event.busSeatReleased !== null &&
                event.busSeatReleased !== undefined ? (
                  <p>
                    Vaga de onibus:{" "}
                    {event.busSeatReleased ? "liberada" : "mantida"}
                  </p>
                ) : null}
                {event.bus ? <p>Onibus: {event.bus.name}</p> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: StudentSummary["status"] }) {
  const classes =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700"
      : status === "SUSPENDED"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${classes}`}>
      {statusLabel(status)}
    </span>
  );
}

function Field({
  label,
  maxLength,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  onChange,
  options,
  required,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">Selecionar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Select({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <select
      aria-label={label}
      className="rounded border border-slate-300 px-3 py-2 text-sm"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function toEnrollmentPayload(enrollment: EnrollmentRecord): StudentPayload["enrollment"] {
  return {
    academicYearId: enrollment.academicYear.id,
    institutionId: enrollment.institution.id,
    shiftId: enrollment.shift.id,
    course: enrollment.course,
    grade: enrollment.grade,
  };
}

function formatDateInput(value: string) {
  return value.slice(0, 10);
}

function cleanPerson(person: StudentPayload["person"]): StudentPayload["person"] {
  return {
    ...person,
    rg: emptyToUndefined(person.rg),
    phone: emptyToUndefined(person.phone),
    email: emptyToUndefined(person.email),
    addressZipCode: emptyToUndefined(person.addressZipCode),
    addressState: emptyToUndefined(person.addressState),
    addressComplement: emptyToUndefined(person.addressComplement),
  };
}

function emptyToUndefined(value?: string) {
  return value && value.length > 0 ? value : undefined;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: StudentSummary["status"]) {
  return status === "ACTIVE"
    ? "Ativo"
    : status === "SUSPENDED"
      ? "Suspenso"
      : "Desligado";
}

function historyEventLabel(eventType: StudentHistoryEvent["eventType"]) {
  const labels: Record<StudentHistoryEvent["eventType"], string> = {
    STUDENT_SUSPENDED: "Suspensao",
    STUDENT_REACTIVATED: "Reativacao",
    STUDENT_TERMINATED: "Desligamento",
    STUDENT_REENROLLED: "Rematricula",
    STUDENT_CARD_ISSUED: "Carteirinha emitida",
    STUDENT_CARD_INVALIDATED: "Carteirinha invalidada",
    INVOICE_CREATED: "Fatura criada",
    INVOICE_CANCELLED: "Fatura cancelada",
    BOARD_MEMBERSHIP_STARTED: "Entrada na diretoria",
    BOARD_MEMBERSHIP_ENDED: "Saida da diretoria",
  };
  return labels[eventType];
}

function reasonLabel(reason: NonNullable<StudentHistoryEvent["suspensionReason"]>) {
  return reason === "NON_PAYMENT"
    ? "Falta de pagamento"
    : reason === "INFRACTION"
      ? "Infracao"
      : "Outro";
}

function terminationLabel(
  reason: NonNullable<StudentHistoryEvent["terminationReason"]>,
) {
  return reason === "WITHDRAWAL" ? "Desistencia" : "Inadimplencia";
}
