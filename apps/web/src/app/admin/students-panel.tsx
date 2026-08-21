"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  TrafficCone,
  UserRound,
} from "lucide-react";
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
  type ReinstateStudentPayload,
  type ReenrollmentPreview,
  type StudentSummary,
} from "../../lib/api";
import {
  maskCep,
  maskCpf,
  maskPhone,
  onlyDigits,
  promptOption,
} from "../../lib/formatters";
import { StudentInvoicesForStudent } from "./finance-panel";
import { adminTheme, cx } from "./admin-theme";
import { StudentCardsForStudent } from "./student-cards-panel";
import {
  AdminConfirmDialog,
  AdminEmptyState,
  AdminFeedback,
  AdminModuleHeader,
  AdminSectionHeader,
  AdminStatusBadge,
  AdminSummaryCard,
} from "./components/admin-ui";
import { StudentCreateView } from "./students/student-create-view";
import { StudentProfileView } from "./students/student-profile-view";

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

export function StudentsPanel({
  initialAcademicYearId,
  initialAction,
  initialBoardMembershipFilter,
  initialInstitutionId,
  initialStatusFilter,
  onClearNavigationContext,
  user,
}: {
  initialAcademicYearId?: string;
  initialAction?: "new";
  initialBoardMembershipFilter?: "all" | "active" | "inactive";
  initialInstitutionId?: string;
  initialStatusFilter?: "active" | "suspended" | "terminated" | "all";
  onClearNavigationContext?: () => void;
  user: ApiUser;
}) {
  const [view, setView] = useState<"list" | "create" | "profile">("list");
  const [profileStudentId, setProfileStudentId] = useState("");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [shifts, setShifts] = useState<BaseRecord[]>([]);
  const [selected, setSelected] = useState<StudentDetail | null>(null);
  const [person, setPerson] = useState<StudentPayload["person"]>(emptyPerson);
  const [guardian, setGuardian] = useState<StudentPayload["guardian"]>();
  const [enrollment, setEnrollment] =
    useState<StudentPayload["enrollment"]>(emptyEnrollment);
  const [createBusId, setCreateBusId] = useState("");
  const [createBuses, setCreateBuses] = useState<BusRecord[]>([]);
  const [createBusesLoading, setCreateBusesLoading] = useState(false);
  const [createBusesError, setCreateBusesError] = useState("");
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reinstateEnrollment, setReinstateEnrollment] =
    useState<StudentPayload["enrollment"]>(emptyEnrollment);
  const [reinstateBusId, setReinstateBusId] = useState("");
  const [reinstateBuses, setReinstateBuses] = useState<BusRecord[]>([]);
  const [reinstateBusesLoading, setReinstateBusesLoading] = useState(false);
  const [reinstateBusesError, setReinstateBusesError] = useState("");
  const [reinstateReason, setReinstateReason] = useState("");
  const [reinstateNote, setReinstateNote] = useState("");
  const [search, setSearch] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "suspended" | "terminated" | "all"
  >("active");
  const [boardMembershipFilter, setBoardMembershipFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
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
    if (initialAcademicYearId) {
      setAcademicYearId(initialAcademicYearId);
    }
    if (initialInstitutionId) {
      setInstitutionId(initialInstitutionId);
    }
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
    if (initialBoardMembershipFilter) {
      setBoardMembershipFilter(initialBoardMembershipFilter);
    }
    setPage(1);
    if (initialAction === "new") {
      setView("create");
    }
  }, [
    initialAcademicYearId,
    initialAction,
    initialBoardMembershipFilter,
    initialInstitutionId,
    initialStatusFilter,
  ]);

  useEffect(() => {
    void loadStudents();
  }, [
    page,
    academicYearId,
    institutionId,
    shiftId,
    statusFilter,
    boardMembershipFilter,
  ]);

  useEffect(() => {
    if (selected || !enrollment.academicYearId) {
      setCreateBusId("");
      setCreateBuses([]);
      setCreateBusesError("");
      return;
    }
    void loadCreateBuses(enrollment.academicYearId);
  }, [selected, enrollment.academicYearId]);

  useEffect(() => {
    if (!reinstateOpen || !reinstateEnrollment.academicYearId) {
      setReinstateBusId("");
      setReinstateBuses([]);
      setReinstateBusesError("");
      return;
    }
    void loadReinstateBuses(reinstateEnrollment.academicYearId);
  }, [reinstateOpen, reinstateEnrollment.academicYearId]);

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
        boardMembership: boardMembershipFilter,
      });
      setStudents(response.data);
      setTotalPages(Math.max(response.pagination.totalPages, 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  function clearListFilters() {
    setSearch("");
    setAcademicYearId("");
    setInstitutionId("");
    setShiftId("");
    setStatusFilter("active");
    setBoardMembershipFilter("all");
    setPage(1);
    onClearNavigationContext?.();
    void loadStudents("");
  }

  async function loadCreateBuses(nextAcademicYearId: string) {
    setCreateBusId("");
    setCreateBusesLoading(true);
    setCreateBusesError("");
    try {
      const response = await api.listBuses({
        status: "active",
        limit: 100,
        sort: "name",
        academicYearId: nextAcademicYearId,
      });
      setCreateBuses(response.data.filter((bus) => !bus.isFull));
    } catch (caught) {
      setCreateBuses([]);
      setCreateBusesError(
        caught instanceof Error ? caught.message : "Erro ao carregar onibus",
      );
    } finally {
      setCreateBusesLoading(false);
    }
  }

  async function loadReinstateBuses(nextAcademicYearId: string) {
    setReinstateBusId("");
    setReinstateBusesLoading(true);
    setReinstateBusesError("");
    try {
      const response = await api.listBuses({
        status: "active",
        limit: 100,
        sort: "name",
        academicYearId: nextAcademicYearId,
      });
      setReinstateBuses(response.data.filter((bus) => !bus.isFull));
    } catch (caught) {
      setReinstateBuses([]);
      setReinstateBusesError(
        caught instanceof Error ? caught.message : "Erro ao carregar onibus",
      );
    } finally {
      setReinstateBusesLoading(false);
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
        cpf: maskCpf(detail.person.cpf),
        rg: detail.person.rg ?? "",
        birthDate: formatDateInput(detail.person.birthDate),
        phone: maskPhone(detail.person.phone ?? ""),
        email: detail.person.email ?? "",
        addressStreet: detail.person.addressStreet,
        addressNumber: detail.person.addressNumber,
        addressNeighborhood: detail.person.addressNeighborhood,
        addressCity: detail.person.addressCity,
        addressZipCode: maskCep(detail.person.addressZipCode ?? ""),
        addressState: detail.person.addressState ?? "",
        addressComplement: detail.person.addressComplement ?? "",
      });
      setGuardian(
        detail.guardian
          ? {
              fullName: detail.guardian.fullName,
              cpf: maskCpf(detail.guardian.cpf ?? ""),
              rg: detail.guardian.rg ?? "",
            }
          : undefined,
      );
      const currentEnrollment = detail.enrollments[0];
      if (currentEnrollment) {
        setEnrollment(toEnrollmentPayload(currentEnrollment));
      }
      prepareReinstatement(detail);
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
    setCreateBusId("");
    resetReinstatement();
  }

  function resetReinstatement() {
    setReinstateOpen(false);
    setReinstateEnrollment(emptyEnrollment);
    setReinstateBusId("");
    setReinstateBuses([]);
    setReinstateBusesError("");
    setReinstateReason("");
    setReinstateNote("");
  }

  function prepareReinstatement(student: StudentDetail) {
    const currentYear = years.find((year) => year.isCurrent) ?? years[0];
    const targetYearId =
      currentYear?.id ?? student.enrollments[0]?.academicYear.id ?? "";
    const existing = student.enrollments.find(
      (item) => item.academicYear.id === targetYearId,
    );
    setReinstateEnrollment(
      existing
        ? toEnrollmentPayload(existing)
        : {
            ...emptyEnrollment,
            academicYearId: targetYearId,
            institutionId: student.enrollments[0]?.institution.id ?? "",
            shiftId: student.enrollments[0]?.shift.id ?? "",
            course: student.enrollments[0]?.course ?? "",
            grade: student.enrollments[0]?.grade ?? "",
          },
    );
    setReinstateBusId("");
    setReinstateReason("");
    setReinstateNote("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.createStudent({
        person: cleanPerson(person),
        guardian: cleanGuardian(guardian),
        enrollment,
        busId: emptyToUndefined(createBusId),
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
          ? { guardian: cleanGuardian(guardian)! }
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
    const reason = promptOption("Selecione o motivo da suspensao:", [
      { label: "Inadimplencia", value: "NON_PAYMENT" },
      { label: "Infracao", value: "INFRACTION" },
      { label: "Outro motivo", value: "OTHER" },
    ]);
    if (!reason) {
      setError("Selecione um motivo valido para suspender o academico.");
      return;
    }
    const justification = window.prompt("Justificativa obrigatoria");
    if (!justification || justification.trim().length < 3) {
      setError("Justificativa obrigatoria");
      return;
    }
    const releaseBusSeat = window.confirm(
      "Suspender este academico?\n\nConfirmar libera a vaga do onibus, se houver. Cancelar mantem a vaga ocupada durante a suspensao.",
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
        `Selecione o onibus para reativar o academico. A capacidade sera validada novamente no backend:\n${available
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
      !window.confirm(
        "Reativar academico mantendo o vinculo atual de onibus?\n\nO historico sera preservado.",
      )
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
    const terminationReason = promptOption("Selecione o motivo do desligamento:", [
      { label: "Desistencia", value: "WITHDRAWAL" },
      { label: "Termino do curso", value: "COURSE_COMPLETION" },
      { label: "Inadimplencia", value: "NON_PAYMENT" },
    ]);
    if (!terminationReason) {
      setError("Selecione um motivo valido para desligar o academico.");
      return;
    }
    const justification = window.prompt("Justificativa obrigatoria");
    if (!justification || justification.trim().length < 3) {
      setError("Justificativa obrigatoria");
      return;
    }
    const confirmed = window.confirm(
      "Confirmar desligamento?\n\nO historico sera preservado, a vaga de onibus sera liberada, a carteirinha ativa sera invalidada e a diretoria ativa sera encerrada se existir. Esta acao nao altera faturas ou boletos.",
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

  function applyReinstateAcademicYear(nextAcademicYearId: string) {
    if (!selected) {
      return;
    }
    const existing = selected.enrollments.find(
      (item) => item.academicYear.id === nextAcademicYearId,
    );
    setReinstateEnrollment(
      existing
        ? toEnrollmentPayload(existing)
        : {
            ...emptyEnrollment,
            academicYearId: nextAcademicYearId,
            institutionId: selected.enrollments[0]?.institution.id ?? "",
            shiftId: selected.enrollments[0]?.shift.id ?? "",
            course: selected.enrollments[0]?.course ?? "",
            grade: selected.enrollments[0]?.grade ?? "",
          },
    );
    setReinstateBusId("");
  }

  async function handleReinstate() {
    if (!selected) {
      return;
    }
    const existing = selected.enrollments.find(
      (item) => item.academicYear.id === reinstateEnrollment.academicYearId,
    );
    if (!reinstateEnrollment.academicYearId) {
      setError("Ano Letivo obrigatorio para religamento");
      return;
    }
    if (!reinstateReason.trim()) {
      setError("Motivo obrigatorio para religamento");
      return;
    }
    if (
      !existing &&
      (!reinstateEnrollment.institutionId ||
        !reinstateEnrollment.shiftId ||
        !reinstateEnrollment.course ||
        !reinstateEnrollment.grade)
    ) {
      setError("Dados academicos obrigatorios para nova matricula");
      return;
    }
    const confirmed = window.confirm(
      "Confirmar religamento? Uma nova carteirinha sera emitida, o vinculo antigo de onibus nao sera restaurado e o financeiro existente sera preservado.",
    );
    if (!confirmed) {
      return;
    }

    const payload: ReinstateStudentPayload = {
      academicYearId: reinstateEnrollment.academicYearId,
      busId: emptyToUndefined(reinstateBusId),
      reason: reinstateReason.trim(),
      note: emptyToUndefined(reinstateNote),
      ...(existing
        ? {}
        : {
            institutionId: reinstateEnrollment.institutionId,
            shiftId: reinstateEnrollment.shiftId,
            course: reinstateEnrollment.course,
            grade: reinstateEnrollment.grade,
          }),
    };

    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.reinstateStudent(selected.id, payload);
      setMessage("Academico religado");
      resetReinstatement();
      await refreshSelected(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao religar");
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

  const resultLabel = loading
    ? "Consultando academicos"
    : students.length === 1
      ? "1 academico encontrado"
      : `${students.length} academicos nesta pagina`;
  const hasActiveFilters = Boolean(
    search ||
      academicYearId ||
      institutionId ||
      shiftId ||
      statusFilter !== "active" ||
      boardMembershipFilter !== "all",
  );

  async function handleCreated() {
    setView("list");
    setMessage("Academico cadastrado com sucesso.");
    setError("");
    if (page !== 1) {
      setPage(1);
      return;
    }
    await loadStudents();
  }

  async function handleProfileChanged() {
    await loadStudents();
  }

  if (view === "create") {
    return (
      <StudentCreateView
        institutions={institutions}
        onCancel={() => setView("list")}
        onCreated={handleCreated}
        shifts={shifts}
        years={years}
      />
    );
  }

  if (view === "profile" && profileStudentId) {
    return (
      <StudentProfileView
        institutions={institutions}
        onBack={() => {
          setView("list");
          setProfileStudentId("");
        }}
        onChanged={handleProfileChanged}
        shifts={shifts}
        studentId={profileStudentId}
        user={user}
        years={years}
      />
    );
  }

  return (
    <div className="grid gap-5">
      <section
        className={cx(
          adminTheme.card,
          "relative overflow-hidden border-[#C8DAD4] p-5 sm:p-6",
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-[#1F6F5F]"
        />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF7F4] text-[#14534D] ring-1 ring-[#D8E9E4]"
                aria-hidden="true"
              >
                <GraduationCap size={22} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
                  Rotas academicas
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950">
                  Academicos
                </h1>
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Consulte e gerencie acadêmicos, matrículas, situação, transporte,
              documentos e informações financeiras.
            </p>
          </div>
          <button
            className={adminTheme.primaryButton}
            onClick={() => {
              setMessage("");
              setError("");
              setView("create");
            }}
            type="button"
          >
            <Plus size={17} strokeWidth={2.2} />
            Novo academico
          </button>
        </div>
      </section>

      <section className={cx(adminTheme.card, "relative z-0 grid gap-4 p-4 sm:p-5")}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <form
            className="relative z-10 flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              void loadStudents(search);
            }}
          >
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Buscar academico</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
                strokeWidth={2}
              />
              <input
                className={cx(adminTheme.control, "w-full pl-9")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por carteirinha, nome ou CPF"
                type="search"
                value={search}
              />
            </label>
            <button className={cx(adminTheme.secondaryButton, "relative z-20 shrink-0 justify-center")} type="submit">
              Buscar
            </button>
            <button
              className={cx(adminTheme.secondaryButton, "relative z-20 shrink-0 justify-center")}
              onClick={clearListFilters}
              type="button"
            >
              Limpar
            </button>
          </form>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <StudentFilterSelect
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
            <StudentFilterSelect
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
            <StudentFilterSelect
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
            <StudentFilterSelect
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
            <StudentFilterSelect
              includeEmptyOption={false}
              label="Diretoria"
              onChange={(value) => {
                setBoardMembershipFilter(
                  (value || "all") as "all" | "active" | "inactive",
                );
                setPage(1);
              }}
              options={[
                { label: "Todos", value: "all" },
                { label: "Somente Diretoria", value: "active" },
                { label: "Fora da Diretoria", value: "inactive" },
              ]}
              value={boardMembershipFilter}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
          <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
            <SlidersHorizontal
              aria-hidden="true"
              className="shrink-0 text-[#1F6F5F]"
              size={16}
              strokeWidth={2}
            />
            <span>{resultLabel}</span>
            {hasActiveFilters ? (
              <span className="rounded-full border border-[#B8D6CF] bg-[#EEF7F4] px-2 py-1 text-xs font-semibold text-[#14534D]">
                filtros ativos
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <button
              aria-label="Pagina anterior"
              className={adminTheme.iconButton}
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              type="button"
            >
              <ChevronLeft size={17} strokeWidth={2.2} />
            </button>
            <span className="min-w-16 text-center font-medium text-slate-700">
              {page}/{totalPages}
            </span>
            <button
              aria-label="Proxima pagina"
              className={adminTheme.iconButton}
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              type="button"
            >
              <ChevronRight size={17} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 shadow-sm">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <section className={cx(adminTheme.card, "overflow-hidden")}>
        <div className="hidden lg:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-[#F8FAFA] text-xs font-semibold uppercase tracking-normal text-slate-500">
              <tr>
                <th className="w-[28%] px-5 py-3">Academico</th>
                <th className="w-[24%] px-5 py-3">Instituicao</th>
                <th className="w-[14%] px-5 py-3">Serie</th>
                <th className="w-[14%] px-5 py-3">Status</th>
                <th className="w-[14%] px-5 py-3">Financeiro</th>
                <th className="w-[6%] px-5 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <StudentTableState colSpan={6} text="Carregando academicos..." />
              ) : students.length === 0 ? (
                <StudentTableState
                  colSpan={6}
                  text="Nenhum academico encontrado para os filtros atuais."
                />
              ) : (
                students.map((student) => (
                  <StudentDesktopRow
                    key={student.id}
                    onAction={() => {
                      setMessage("");
                      setError("");
                      setProfileStudentId(student.id);
                      setView("profile");
                    }}
                    student={student}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 lg:hidden">
          {loading ? (
            <StudentMobileState text="Carregando academicos..." />
          ) : students.length === 0 ? (
            <StudentMobileState text="Nenhum academico encontrado para os filtros atuais." />
          ) : (
            students.map((student) => (
              <StudentMobileCard
                key={student.id}
                onAction={() => {
                  setMessage("");
                  setError("");
                  setProfileStudentId(student.id);
                  setView("profile");
                }}
                student={student}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StudentDesktopRow({
  onAction,
  student,
}: {
  onAction: () => void;
  student: StudentSummary;
}) {
  const enrollment = student.currentEnrollment;
  return (
    <tr className="group bg-white transition-colors duration-150 hover:bg-[#F8FAFA] motion-reduce:transition-none">
      <td className="px-5 py-4">
        <StudentIdentity student={student} />
      </td>
      <td className="px-5 py-4">
        <p className="truncate font-semibold text-slate-900">
          {enrollment?.institution.name ?? "Sem instituicao"}
        </p>
        <p className="mt-1 truncate text-xs text-slate-500">
          {compactJoin([enrollment?.course, enrollment?.shift.name]) || "Sem curso"}
        </p>
      </td>
      <td className="px-5 py-4">
        <p className="font-semibold text-slate-900">{enrollment?.grade ?? "-"}</p>
        <p className="mt-1 text-xs text-slate-500">
          {enrollment?.academicYear.year
            ? `Ano ${enrollment.academicYear.year}`
            : "Sem ano letivo"}
        </p>
      </td>
      <td className="px-5 py-4">
        <ModernStatusBadge status={student.status} />
        {student.activeBoardMembership ? (
          <p className="mt-2 text-xs font-medium text-[#14534D]">Diretoria ativa</p>
        ) : null}
      </td>
      <td className="px-5 py-4">
        <FinanceSummary eligible={student.canReceiveFutureInvoices} />
      </td>
      <td className="px-5 py-4 text-right">
        <button
          aria-label={`Acoes de ${student.person.fullName}`}
          className={adminTheme.iconButton}
          onClick={onAction}
          type="button"
        >
          <MoreVertical size={17} strokeWidth={2.2} />
        </button>
      </td>
    </tr>
  );
}

function StudentMobileCard({
  onAction,
  student,
}: {
  onAction: () => void;
  student: StudentSummary;
}) {
  const enrollment = student.currentEnrollment;
  return (
    <article className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <StudentIdentity student={student} />
        <button
          aria-label={`Acoes de ${student.person.fullName}`}
          className={adminTheme.iconButton}
          onClick={onAction}
          type="button"
        >
          <MoreVertical size={17} strokeWidth={2.2} />
        </button>
      </div>
      <div className="mt-4 grid gap-3 rounded-lg border border-slate-200/80 bg-[#F8FAFA] p-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            Instituicao
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {enrollment?.institution.name ?? "Sem instituicao"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {compactJoin([enrollment?.course, enrollment?.shift.name]) || "Sem curso"}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <ModernStatusBadge status={student.status} />
          <FinanceSummary eligible={student.canReceiveFutureInvoices} compact />
        </div>
      </div>
    </article>
  );
}

function StudentIdentity({ student }: { student: StudentSummary }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF7F4] text-[#14534D] ring-1 ring-[#D8E9E4]"
        aria-hidden="true"
      >
        <UserRound size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-950">
          {student.person.fullName}
        </p>
        <p className="mt-1 truncate text-xs text-slate-500">
          Carteirinha {student.currentStudentCard?.cardNumber ?? "nao emitida"}
        </p>
      </div>
    </div>
  );
}

function FinanceSummary({
  compact = false,
  eligible,
}: {
  compact?: boolean;
  eligible: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
        eligible
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <CircleDollarSign size={compact ? 13 : 14} strokeWidth={2.2} />
      {eligible ? "Elegivel" : "Bloqueado"}
    </span>
  );
}

function ModernStatusBadge({ status }: { status: StudentSummary["status"] }) {
  const classes =
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "SUSPENDED"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
        classes,
      )}
    >
      <BadgeCheck size={14} strokeWidth={2.2} />
      {statusLabel(status)}
    </span>
  );
}

function StudentFilterSelect({
  includeEmptyOption = true,
  label,
  onChange,
  options,
  value,
}: {
  includeEmptyOption?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className={cx(adminTheme.control, "w-full")}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {includeEmptyOption ? <option value="">{label}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StudentTableState({
  colSpan,
  text,
}: {
  colSpan: number;
  text: string;
}) {
  return (
    <tr>
      <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}

function StudentMobileState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-[#F8FAFA] px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" • ");
}

export function ReenrollmentsPanel() {
  const [candidates, setCandidates] = useState<StudentSummary[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [institutions, setInstitutions] = useState<BaseRecord[]>([]);
  const [shifts, setShifts] = useState<BaseRecord[]>([]);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [search, setSearch] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [preview, setPreview] = useState<ReenrollmentPreview | null>(null);
  const [enrollment, setEnrollment] =
    useState<StudentPayload["enrollment"]>(emptyEnrollment);
  const [busId, setBusId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingReenrollment, setPendingReenrollment] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedYear = useMemo(
    () => years.find((year) => year.id === academicYearId),
    [academicYearId, years],
  );
  const currentAcademicYear = useMemo(
    () => years.find((year) => year.isCurrent) ?? null,
    [years],
  );
  const targetYearOptions = useMemo(
    () =>
      currentAcademicYear
        ? years
            .filter((year) => year.year >= currentAcademicYear.year)
            .map((year) => ({
              label: year.isCurrent ? `${year.year} atual` : String(year.year),
              value: year.id,
            }))
        : [],
    [currentAcademicYear, years],
  );
  const visibleCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        const enrollment = candidate.currentEnrollment;
        if (institutionFilter && enrollment?.institution.id !== institutionFilter) {
          return false;
        }
        return true;
      }),
    [candidates, institutionFilter],
  );
  const institutionOptions = useMemo(
    () =>
      uniqueOptions(
        candidates.map((candidate) => ({
          label: candidate.currentEnrollment?.institution.name ?? "",
          value: candidate.currentEnrollment?.institution.id ?? "",
        })),
      ),
    [candidates],
  );
  const selectedBus = useMemo(
    () => buses.find((bus) => bus.id === busId) ?? null,
    [busId, buses],
  );
  const summary = useMemo(
    () => ({
      eligible: candidates.length,
      pending: visibleCandidates.length,
      completed: completedCount,
      blocked: preview && !preview.eligible ? 1 : 0,
    }),
    [candidates.length, completedCount, preview, visibleCandidates.length],
  );

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
      setAcademicYearId(target?.id ?? "");
      if (!target) {
        setCandidates([]);
        setLoading(false);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Erro ao carregar referencias",
      );
      setLoading(false);
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
        academicYearId: nextPreview.academicYear.id,
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
      setError(preview?.blockingReason ?? "Selecione um acadêmico elegível");
      return;
    }
    setPendingReenrollment(true);
  }

  async function confirmReenrollment() {
    if (!selected || !preview?.eligible) {
      setError(preview?.blockingReason ?? "Selecione um acadêmico elegível");
      setPendingReenrollment(false);
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
      setMessage("Rematrícula criada");
      setCompletedCount((current) => current + 1);
      setPendingReenrollment(false);
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
    <div className="grid min-w-0 gap-5">
      <AdminModuleHeader
        description="Prepare rematrículas anuais preservando elegibilidade, vínculos acadêmicos, transporte e validações já homologadas."
        eyebrow="Fluxo acadêmico"
        icon={ClipboardCheck}
        title="Rematrículas"
      />

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          description={selectedYear ? `Ano de destino ${selectedYear.year}.` : "Ano de destino não selecionado."}
          icon={GraduationCap}
          label="Total elegível"
          tone="blue"
          value={summary.eligible}
        />
        <AdminSummaryCard
          description="Acadêmicos disponíveis na fila atual."
          icon={UserRound}
          label="Pendentes"
          tone="orange"
          value={summary.pending}
        />
        <AdminSummaryCard
          description="Criadas nesta sessão da tela."
          icon={ClipboardCheck}
          label="Concluídas"
          tone="green"
          value={summary.completed}
        />
        <AdminSummaryCard
          description="Bloqueio exibido na prévia selecionada."
          icon={TrafficCone}
          label="Com bloqueio"
          tone="red"
          value={summary.blocked}
        />
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)] 2xl:grid-cols-[minmax(0,1.55fr)_minmax(400px,0.85fr)]">
      <section className={cx(adminTheme.card, "min-w-0 overflow-hidden")}>
        <AdminSectionHeader
          description="Busque e filtre a fila sem alterar os critérios de elegibilidade."
          title="Candidatos elegíveis"
        />
        <div className="border-b border-slate-200/80 p-3 sm:p-4">
          <div className="grid min-w-0 items-end gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(160px,200px)_minmax(180px,240px)]">
            <form
              className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void loadCandidates(search);
              }}
            >
              <input
                className={cx(adminTheme.control, "min-w-0 flex-1")}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar candidato"
                type="search"
                value={search}
              />
              <button
                className={cx(adminTheme.primaryButton, "w-full sm:w-auto")}
                type="submit"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
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
              options={targetYearOptions}
              value={academicYearId}
            />
            <Select
              label="Instituição anterior"
              onChange={setInstitutionFilter}
              options={institutionOptions}
              value={institutionFilter}
            />
          </div>
        </div>

        {message ? <AdminFeedback tone="green">{message}</AdminFeedback> : null}
        {error ? <AdminFeedback tone="red">{error}</AdminFeedback> : null}

        <div className="grid gap-2 p-3 sm:p-4">
          {loading ? (
            <AdminEmptyState loading title="Carregando candidatos" />
          ) : visibleCandidates.length === 0 ? (
            <AdminEmptyState
              description="Ajuste a busca ou selecione outro ano de destino."
              title="Nenhum candidato elegível"
            />
          ) : (
            visibleCandidates.map((candidate) => {
              const previousEnrollment = candidate.currentEnrollment;
              const active = selected?.id === candidate.id;
              const pendingDestination =
                Boolean(selectedYear) &&
                previousEnrollment?.academicYear.year !== selectedYear?.year;
              return (
              <button
                className={cx(
                  "grid min-w-0 gap-2 rounded-lg border p-3 text-left text-sm transition duration-150 focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 sm:grid-cols-[minmax(13rem,1.2fr)_minmax(16rem,1.4fr)_auto] sm:items-center",
                  active
                    ? "border-[#1F6F5F] bg-[#F2F8F6] shadow-sm"
                    : "border-slate-200/80 bg-white hover:border-[#8DB7AD] hover:bg-slate-50",
                )}
                key={candidate.id}
                onClick={() => void selectCandidate(candidate)}
                type="button"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold text-slate-950">
                    {candidate.person.fullName}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {candidate.person.cpfMasked}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <AdminStatusBadge tone="green">
                      Elegível para rematrícula
                    </AdminStatusBadge>
                    {pendingDestination ? (
                      <AdminStatusBadge tone="orange">
                        Aguardando rematrícula
                      </AdminStatusBadge>
                    ) : null}
                  </div>
                </div>
                <div className="grid min-w-0 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <CompactInfo label="Ano anterior" value={previousEnrollment?.academicYear.year} />
                  <CompactInfo label="Instituição" value={previousEnrollment?.institution.name} />
                  <CompactInfo label="Curso" value={previousEnrollment?.course} />
                  <CompactInfo label="Série" value={previousEnrollment?.grade} />
                  <CompactInfo label="Turno" value={previousEnrollment?.shift.name} />
                  <CompactInfo label="Ônibus" value="Ver prévia" />
                </div>
                <div className="flex justify-start sm:justify-end">
                  <span className={cx(adminTheme.secondaryButton, "h-8 px-2 text-xs")}>
                    {active ? "Selecionado" : "Preparar rematrícula"}
                  </span>
                </div>
              </button>
            );
            })
          )}
        </div>
      </section>

      <form
        className={cx(adminTheme.card, "min-w-0 overflow-hidden")}
        onSubmit={handleReenroll}
      >
        <AdminSectionHeader
          description="Confira a prévia e ajuste a nova matrícula anual."
          title="Nova rematrícula"
        />

        {selected && preview ? (
          <div className="grid gap-3 p-3 sm:p-4">
            <div className="grid gap-2">
              <AdminStatusBadge tone={preview.eligible ? "green" : "red"}>
                {preview.eligible ? "Prévia válida" : "Bloqueio encontrado"}
              </AdminStatusBadge>
              <PreviewBlock title="ACADÊMICO">
                <CompactInfo label="Nome" value={selected.person.fullName} />
                <CompactInfo label="CPF" value={selected.person.cpfMasked} />
                <CompactInfo
                  label="Motivo da elegibilidade"
                  value={reenrollmentReason(preview)}
                />
              </PreviewBlock>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <PreviewBlock title="MATRÍCULA ANTERIOR">
                <EnrollmentSummary enrollment={preview.previousEnrollment} />
                <CompactInfo
                  label="Ônibus"
                  value={preview.previousBusAssignment?.bus.name ?? "Sem ônibus"}
                />
              </PreviewBlock>
              <div className="grid place-items-center text-slate-400 md:px-1 xl:py-0 2xl:px-1">
                <ChevronRight aria-hidden="true" className="hidden h-5 w-5 md:block xl:hidden 2xl:block" />
                <span className="text-lg md:hidden xl:block 2xl:hidden">↓</span>
              </div>
              <PreviewBlock title={`NOVA MATRÍCULA — ${preview.academicYear.year}`}>
                <CompactInfo label="Instituição" value={institutionName(institutions, enrollment.institutionId)} />
                <CompactInfo label="Curso" value={enrollment.course} />
                <CompactInfo label="Série" value={enrollment.grade} />
                <CompactInfo label="Turno" value={shiftName(shifts, enrollment.shiftId)} />
                <CompactInfo label="Ônibus" value={selectedBus?.name ?? "Sem ônibus"} />
              </PreviewBlock>
            </div>

            {preview.blockingReason ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-semibold">BLOQUEIO</p>
                <p className="mt-1 break-words">{preview.blockingReason}</p>
              </div>
            ) : null}

            <EnrollmentFields
              adaptiveLayout
              enrollment={enrollment}
              institutions={institutions}
              setEnrollment={setEnrollment}
              shifts={shifts}
              title="Campos editáveis"
              years={years}
            />

            <div className="grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
              <h3 className="text-sm font-semibold text-slate-950">
                Transporte
              </h3>
              <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <CompactInfo
                  label="Ônibus anterior"
                  value={preview.previousBusAssignment?.bus.name ?? "Sem ônibus"}
                />
                <CompactInfo
                  label="Nova matrícula"
                  value={selectedBus?.name ?? "Sem ônibus"}
                  tone={
                    (preview.previousBusAssignment?.bus.id ?? "") !== (selectedBus?.id ?? "")
                      ? "changed"
                      : "default"
                  }
                />
              </div>
              <select
                className={cx(adminTheme.control, "w-full min-w-0")}
                onChange={(event) => setBusId(event.target.value)}
                value={busId}
              >
                <option value="">Sem ônibus nesta rematrícula</option>
                {buses.map((bus) => (
                  <option disabled={Boolean(bus.isFull)} key={bus.id} value={bus.id}>
                    {bus.name} - {bus.availableSeats ?? bus.capacity} vagas
                  </option>
                ))}
              </select>
              <input
                className={cx(adminTheme.control, "w-full min-w-0")}
                maxLength={240}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Observação opcional"
                value={note}
              />
            </div>

            <button
              className={cx(adminTheme.primaryButton, "w-full")}
              disabled={saving || !preview.eligible}
              type="submit"
            >
              {saving ? "Criando..." : "Concluir rematrícula"}
            </button>
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <AdminEmptyState
              description="Selecione uma linha da fila para ver acadêmico, matrícula anterior, nova matrícula e transporte."
              title="Nenhum candidato selecionado"
            />
          </div>
        )}
      </form>
      </div>
      {pendingReenrollment ? (
        <AdminConfirmDialog
          confirmLabel={saving ? "Criando..." : "Concluir rematrícula"}
          description={`Acadêmico: ${selected?.person.fullName ?? "-"} · Ano destino: ${selectedYear?.year ?? "-"} · Instituição: ${institutionName(institutions, enrollment.institutionId)} · Curso: ${enrollment.course || "-"} · Série: ${enrollment.grade || "-"} · Turno: ${shiftName(shifts, enrollment.shiftId)} · Ônibus: ${selectedBus?.name ?? "Sem ônibus"}`}
          disabled={saving}
          onCancel={() => setPendingReenrollment(false)}
          onConfirm={() => void confirmReenrollment()}
          title="Confirmar rematrícula"
          tone="orange"
        />
      ) : null}
    </div>
  );
}

function uniqueOptions(options: Array<{ label: string; value: string }>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function CompactInfo({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "changed";
  value: number | string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
      <p
        className={cx(
          "mt-0.5 break-words text-sm font-medium text-slate-800",
          tone === "changed" && "text-[#0F6B5E]",
        )}
      >
        {value === null || value === undefined || value === "" ? "-" : value}
      </p>
    </div>
  );
}

function PreviewBlock({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className={cx(adminTheme.softPanel, "min-w-0 p-3")}>
      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">{title}</h3>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function EnrollmentSummary({
  enrollment,
}: {
  enrollment: EnrollmentRecord | null | undefined;
}) {
  return (
    <>
      <CompactInfo label="Ano" value={enrollment?.academicYear.year} />
      <CompactInfo label="Instituição" value={enrollment?.institution.name} />
      <CompactInfo label="Curso" value={enrollment?.course} />
      <CompactInfo label="Série" value={enrollment?.grade} />
      <CompactInfo label="Turno" value={enrollment?.shift.name} />
    </>
  );
}

function institutionName(institutions: BaseRecord[], institutionId: string) {
  return institutions.find((institution) => institution.id === institutionId)?.name ?? "-";
}

function shiftName(shifts: BaseRecord[], shiftId: string) {
  return shifts.find((shift) => shift.id === shiftId)?.name ?? "-";
}

function reenrollmentReason(preview: ReenrollmentPreview) {
  if (!preview.eligible) return preview.blockingReason ?? "Prévia bloqueada";
  if (preview.previousEnrollment) {
    return "Matrícula anterior elegível para renovação";
  }
  return "Sem matrícula no ano destino";
}

function PersonFields({
  person,
  setPerson,
}: {
  person: StudentPayload["person"];
  setPerson: (person: StudentPayload["person"]) => void;
}) {
  function update(key: keyof StudentPayload["person"], value: string) {
    const masked =
      key === "cpf"
        ? maskCpf(value)
        : key === "phone"
          ? maskPhone(value)
          : key === "addressZipCode"
            ? maskCep(value)
            : value;
    setPerson({ ...person, [key]: masked });
  }

  return (
    <div className="mt-4 grid gap-3">
      <h3 className="text-sm font-semibold text-slate-950">Dados pessoais</h3>
      <Field label="Nome completo" onChange={(value) => update("fullName", value)} required value={person.fullName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="CPF" onChange={(value) => update("cpf", value)} placeholder="000.000.000-00" required value={person.cpf} />
        <Field label="RG" onChange={(value) => update("rg", value)} value={person.rg ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nascimento" onChange={(value) => update("birthDate", value)} required type="date" value={person.birthDate} />
        <Field label="Telefone" onChange={(value) => update("phone", value)} placeholder="(00) 00000-0000" value={person.phone ?? ""} />
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
        <Field label="CEP" onChange={(value) => update("addressZipCode", value)} placeholder="00000-000" value={person.addressZipCode ?? ""} />
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
    setGuardian({ ...current, [key]: key === "cpf" ? maskCpf(value) : value });
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
        <Field label="CPF" onChange={(value) => update("cpf", value)} placeholder="000.000.000-00" value={current.cpf ?? ""} />
        <Field label="RG" onChange={(value) => update("rg", value)} value={current.rg ?? ""} />
      </div>
    </div>
  );
}

function EnrollmentFields({
  adaptiveLayout = false,
  enrollment,
  institutions,
  setEnrollment,
  shifts,
  title = "Matricula inicial",
  years,
}: {
  adaptiveLayout?: boolean;
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
  const pairGrid = adaptiveLayout
    ? "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr))]"
    : "grid gap-3 sm:grid-cols-2";
  const labelClassName = adaptiveLayout
    ? "block min-w-0 text-sm font-medium text-slate-700"
    : undefined;
  const controlClassName = adaptiveLayout
    ? cx(adminTheme.control, "mt-1 w-full min-w-0")
    : undefined;

  return (
    <div className="mt-4 grid gap-3">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className={pairGrid}>
        <LabeledSelect
          controlClassName={controlClassName}
          label="Ano Letivo"
          labelClassName={labelClassName}
          onChange={(value) => update("academicYearId", value)}
          options={years.map((year) => ({
            label: year.isCurrent ? `${year.year} atual` : String(year.year),
            value: year.id,
          }))}
          required
          value={enrollment.academicYearId}
        />
        <LabeledSelect
          controlClassName={controlClassName}
          label="Instituicao"
          labelClassName={labelClassName}
          onChange={(value) => update("institutionId", value)}
          options={institutions.map((item) => ({ label: item.name, value: item.id }))}
          required
          value={enrollment.institutionId}
        />
      </div>
      <div className={pairGrid}>
        <Field
          controlClassName={controlClassName}
          label="Curso"
          labelClassName={labelClassName}
          onChange={(value) => update("course", value)}
          required
          value={enrollment.course}
        />
        <Field
          controlClassName={controlClassName}
          label="Serie"
          labelClassName={labelClassName}
          onChange={(value) => update("grade", value)}
          required
          value={enrollment.grade}
        />
      </div>
      <LabeledSelect
        controlClassName={controlClassName}
        label="Turno"
        labelClassName={labelClassName}
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
          "Confirmar troca de onibus?\n\nA vaga do onibus anterior sera liberada e uma vaga sera ocupada no novo onibus. A capacidade sera validada novamente.",
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
    const confirmed = window.confirm(
      "Liberar a vaga deste onibus?\n\nO vinculo ativo sera encerrado e a vaga ficara disponivel para outro academico.",
    );
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

function StudentPhoto({
  studentId,
  onChanged,
}: {
  studentId: string;
  onChanged?: () => Promise<void>;
}) {
  const [photo, setPhoto] = useState<StudentDocumentRecord | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPhoto();
  }, [studentId]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(previewUrl);
    };
  }, [previewUrl]);

  async function loadPhoto() {
    setLoading(true);
    setError("");
    try {
      const response = await api.getStudentPhoto(studentId);
      setPhoto(response.photo);
      revokeObjectUrl(photoUrl);
      setPhotoUrl("");
      if (response.photo) {
        const { blob } = await api.downloadStudentPhoto(studentId, "inline");
        const nextPhotoUrl = URL.createObjectURL(blob);
        const canPreview = await canRenderImage(nextPhotoUrl);
        if (!canPreview) {
          revokeObjectUrl(nextPhotoUrl);
          setError(
            "A foto oficial ativa nao pode ser exibida. Remova e envie novamente um arquivo JPG ou PNG valido.",
          );
          return;
        }
        setPhotoUrl(nextPhotoUrl);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar foto");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(file: File | undefined) {
    setError("");
    setMessage("");
    revokeObjectUrl(previewUrl);
    setPreviewUrl("");
    setSelectedFile(null);
    if (!file) {
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Selecione uma foto JPG, JPEG ou PNG.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("A foto deve ter no maximo 8 MB.");
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    const canPreview = await canRenderImage(nextPreviewUrl);
    if (!canPreview) {
      revokeObjectUrl(nextPreviewUrl);
      setError("O arquivo selecionado nao pode ser exibido como foto valida.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
  }

  async function handleSave() {
    if (!selectedFile) {
      setError("Selecione uma foto oficial para enviar.");
      return;
    }
    const confirmed = photo
      ? window.confirm("Substituir a foto oficial atual?")
      : true;
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.uploadOrReplaceStudentPhoto(studentId, selectedFile);
      setMessage(photo ? "Foto oficial substituida" : "Foto oficial adicionada");
      setSelectedFile(null);
      revokeObjectUrl(previewUrl);
      setPreviewUrl("");
      await loadPhoto();
      await onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao enviar foto");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!photo) {
      return;
    }
    const confirmed = window.confirm("Remover logicamente a foto oficial?");
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.removeStudentPhoto(studentId);
      setMessage("Foto oficial removida");
      setPhoto(null);
      revokeObjectUrl(photoUrl);
      setPhotoUrl("");
      await onChanged?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao remover foto");
    } finally {
      setSaving(false);
    }
  }

  const displayUrl = previewUrl || photoUrl;

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">Foto oficial</h3>
          <p className="mt-1 text-xs text-slate-500">
            Formatos permitidos: JPG, JPEG e PNG. Tamanho maximo: 8 MB.
            Recomendamos uma foto no formato 3x4.
          </p>
        </div>
        <button
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
          disabled={loading || saving}
          onClick={() => void loadPhoto()}
          type="button"
        >
          Atualizar
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="flex h-40 w-28 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Foto oficial do academico"
              className="h-full w-full object-cover"
              src={displayUrl}
            />
          ) : (
            <span className="px-3 text-center text-xs text-slate-500">
              Sem foto oficial
            </span>
          )}
        </div>
        <div className="grid content-start gap-2">
          {!photo ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              A foto e opcional. Quando nao houver foto, a carteirinha sera
              gerada com uma area padrao.
            </p>
          ) : null}
          {photo ? (
            <p className="text-xs text-slate-600">
              Foto ativa: {photo.extension.toUpperCase()} -{" "}
              {formatBytes(photo.sizeBytes)} - enviada em{" "}
              {formatDateTime(photo.createdAt)}
            </p>
          ) : null}
          <input
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            className="block w-full text-xs text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
            disabled={saving}
            onChange={(event) => void handleSelect(event.target.files?.[0])}
            type="file"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
              disabled={saving || !selectedFile}
              onClick={() => void handleSave()}
              type="button"
            >
              {photo ? "Substituir foto" : "Adicionar foto"}
            </button>
            {photo ? (
              <button
                className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-60"
                disabled={saving}
                onClick={() => void handleRemove()}
                type="button"
              >
                Remover
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

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
  controlClassName,
  label,
  labelClassName,
  maxLength,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  controlClassName?: string;
  label: string;
  labelClassName?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className={labelClassName ?? "block text-sm font-medium text-slate-700"}>
      {label}
      <input
        className={controlClassName ?? "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function LabeledSelect({
  controlClassName,
  label,
  labelClassName,
  onChange,
  options,
  required,
  value,
}: {
  controlClassName?: string;
  label: string;
  labelClassName?: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
  value: string;
}) {
  return (
    <label className={labelClassName ?? "block text-sm font-medium text-slate-700"}>
      {label}
      <select
        className={controlClassName ?? "mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"}
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
      className={cx(adminTheme.control, "w-full min-w-0")}
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
    cpf: onlyDigits(person.cpf),
    rg: emptyToUndefined(person.rg),
    phone: emptyToUndefined(onlyDigits(person.phone ?? "")),
    email: emptyToUndefined(person.email),
    addressZipCode: emptyToUndefined(onlyDigits(person.addressZipCode ?? "")),
    addressState: emptyToUndefined(person.addressState),
    addressComplement: emptyToUndefined(person.addressComplement),
  };
}

function cleanGuardian(
  guardian?: StudentPayload["guardian"],
): StudentPayload["guardian"] | undefined {
  if (!guardian?.fullName) {
    return undefined;
  }
  return {
    ...guardian,
    cpf: emptyToUndefined(onlyDigits(guardian.cpf ?? "")),
    rg: emptyToUndefined(guardian.rg),
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

function revokeObjectUrl(value: string) {
  if (value) {
    URL.revokeObjectURL(value);
  }
}

function canRenderImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(false);
    }, 5000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(true);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    image.src = url;
  });
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
    STUDENT_REINSTATED: "Religamento",
    STUDENT_REENROLLED: "Rematricula",
    STUDENT_CARD_ISSUED: "Carteirinha emitida",
    STUDENT_CARD_INVALIDATED: "Carteirinha invalidada",
    INVOICE_CREATED: "Fatura criada",
    INVOICE_CANCELLED: "Fatura cancelada",
    BANK_SLIP_ISSUED: "Boleto emitido",
    BANK_SLIP_PAYMENT_CONFIRMED: "Pagamento confirmado",
    BANK_SLIP_CANCELLATION_REQUESTED: "Cancelamento de boleto solicitado",
    BANK_SLIP_CANCELLED: "Boleto cancelado",
    MANUAL_FINANCIAL_INCOME_RECORDED: "Entrada financeira",
    BOARD_MEMBERSHIP_STARTED: "Entrada na diretoria",
    BOARD_MEMBERSHIP_ENDED: "Saida da diretoria",
    OFFICIAL_DOCUMENT_ISSUED: "Documento emitido",
    OFFICIAL_DOCUMENT_INVALIDATED: "Documento invalidado",
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
  if (reason === "WITHDRAWAL") return "Desistencia";
  if (reason === "COURSE_COMPLETION") return "Termino do curso";
  if (reason === "UNSPECIFIED") return "Nao informado no legado";
  return "Inadimplencia";
}
