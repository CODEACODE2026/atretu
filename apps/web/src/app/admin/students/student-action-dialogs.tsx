"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AcademicYear,
  BaseRecord,
  BoardMemberRole,
  BusRecord,
  ReinstateStudentPayload,
  StudentDetail,
  StudentPayload,
} from "../../../lib/api";
import { api } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { Field, LabeledSelect, StudentAcademicFields } from "./student-form-fields";
import type { StudentProfileAction } from "./student-profile-header";
import { emptyToUndefined } from "./student-profile-utils";

export function StudentActionDialog({
  action,
  institutions,
  onClose,
  onDone,
  shifts,
  student,
  years,
}: {
  action: Exclude<StudentProfileAction, "edit">;
  institutions: BaseRecord[];
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
  shifts: BaseRecord[];
  student: StudentDetail;
  years: AcademicYear[];
}) {
  const currentEnrollment = student.enrollments[0];
  const activeYears = useMemo(
    () =>
      years.filter(
        (year) =>
          year.status === "ACTIVE" && year.year >= 2000 && year.year <= 9999,
      ),
    [years],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState("");
  const [note, setNote] = useState("");
  const [boardRole, setBoardRole] = useState<BoardMemberRole>("MEMBER");
  const [releaseBusSeat, setReleaseBusSeat] = useState(true);
  const [busId, setBusId] = useState("");
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [enrollment, setEnrollment] = useState<StudentPayload["enrollment"]>(() => {
    const base = currentEnrollment;
    const validYears = years.filter(
      (year) =>
        year.status === "ACTIVE" && year.year >= 2000 && year.year <= 9999,
    );
    const targetYear =
      validYears.find((year) => year.isCurrent) ??
      validYears[0];
    return {
      academicYearId: targetYear?.id ?? base?.academicYear.id ?? "",
      institutionId: base?.institution.id ?? "",
      shiftId: base?.shift.id ?? "",
      course: base?.course ?? "",
      grade: base?.grade ?? "",
    };
  });

  const title = useMemo(() => actionTitle(action), [action]);
  const selectedYearEnrollment = useMemo(
    () =>
      student.enrollments.find(
        (studentEnrollment) =>
          studentEnrollment.academicYear.id === enrollment.academicYearId,
      ),
    [enrollment.academicYearId, student.enrollments],
  );

  useEffect(() => {
    if (action === "update-board-role") {
      setBoardRole(student.activeBoardMembership?.role ?? "MEMBER");
      return;
    }
    if (action === "start-board") {
      setBoardRole("MEMBER");
    }
  }, [action, student.activeBoardMembership?.role]);

  useEffect(() => {
    if (action !== "reinstate" || !selectedYearEnrollment) {
      return;
    }
    setEnrollment((current) => ({
      ...current,
      institutionId: selectedYearEnrollment.institution.id,
      shiftId: selectedYearEnrollment.shift.id,
      course: selectedYearEnrollment.course,
      grade: selectedYearEnrollment.grade,
    }));
  }, [action, selectedYearEnrollment]);

  useEffect(() => {
    const academicYearId =
      action === "reinstate" ? enrollment.academicYearId : currentEnrollment?.academicYear.id;
    if (!academicYearId || (action !== "reactivate" && action !== "reinstate")) {
      setBuses([]);
      setBusId("");
      return;
    }
    void loadBuses(academicYearId);
  }, [action, currentEnrollment?.academicYear.id, enrollment.academicYearId]);

  async function loadBuses(academicYearId: string) {
    try {
      const response = await api.listBuses({
        status: "active",
        limit: 100,
        sort: "name",
        academicYearId,
      });
      setBuses(response.data.filter((bus) => !bus.isFull));
    } catch {
      setBuses([]);
    }
  }

  async function submit() {
    setError("");
    if ((action === "suspend" || action === "terminate") && justification.trim().length < 3) {
      setError("Justificativa obrigatoria.");
      return;
    }
    if (action === "suspend" && !reason) {
      setError("Selecione o motivo da suspensao.");
      return;
    }
    if (action === "terminate" && !reason) {
      setError("Selecione o motivo do desligamento.");
      return;
    }
    const selectedYear = activeYears.find((year) => year.id === enrollment.academicYearId);
    if (action === "reinstate" && (!enrollment.academicYearId || !reason.trim())) {
      setError("Ano letivo e motivo sao obrigatorios para religamento.");
      return;
    }
    if (action === "reinstate" && !selectedYear) {
      setError("Selecione um ano letivo ativo para religar o academico.");
      return;
    }
    if (
      action === "reinstate" &&
      !selectedYearEnrollment &&
      (!enrollment.institutionId ||
        !enrollment.shiftId ||
        !enrollment.course.trim() ||
        !enrollment.grade.trim())
    ) {
      setError("Instituicao, curso, serie e turno sao obrigatorios para religamento.");
      return;
    }

    setSaving(true);
    try {
      if (action === "suspend") {
        await api.suspendStudent(student.id, {
          reason: reason as "NON_PAYMENT" | "INFRACTION" | "OTHER",
          justification: justification.trim(),
          releaseBusSeat,
        });
        await onDone("Academico suspenso.");
      } else if (action === "reactivate") {
        await api.reactivateStudent(student.id, {
          busId: emptyToUndefined(busId),
          note: emptyToUndefined(note),
        });
        await onDone("Academico reativado.");
      } else if (action === "terminate") {
        await api.terminateStudent(student.id, {
          terminationReason: reason as "WITHDRAWAL" | "NON_PAYMENT",
          justification: justification.trim(),
        });
        await onDone("Academico desligado.");
      } else if (action === "reinstate") {
        const payload: ReinstateStudentPayload = {
          academicYearId: enrollment.academicYearId,
          busId: emptyToUndefined(busId),
          reason: reason.trim(),
          note: emptyToUndefined(note),
        };
        if (!selectedYearEnrollment) {
          payload.institutionId = enrollment.institutionId;
          payload.shiftId = enrollment.shiftId;
          payload.course = enrollment.course;
          payload.grade = enrollment.grade;
        }
        await api.reinstateStudent(student.id, payload);
        await onDone("Academico religado.");
      } else if (action === "start-board") {
        await api.startBoardMembership(student.id, {
          note: emptyToUndefined(note),
          role: boardRole,
        });
        await onDone("Diretoria ativada.");
      } else if (action === "update-board-role" && student.activeBoardMembership) {
        await api.updateBoardMembershipRole(
          student.id,
          student.activeBoardMembership.id,
          {
            note: emptyToUndefined(note),
            role: boardRole,
          },
        );
        await onDone("Cargo da diretoria alterado.");
      } else if (action === "end-board" && student.activeBoardMembership) {
        await api.endBoardMembership(student.id, student.activeBoardMembership.id, {
          note: emptyToUndefined(note),
        });
        await onDone("Diretoria inativada.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao executar acao");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-6">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
              Acao operacional
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{title}</h2>
          </div>
          <button className={adminTheme.secondaryButton} disabled={saving} onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          {action === "suspend" ? (
            <>
              <LabeledSelect
                label="Motivo"
                onChange={setReason}
                options={[
                  { label: "Inadimplencia", value: "NON_PAYMENT" },
                  { label: "Infracao", value: "INFRACTION" },
                  { label: "Outro motivo", value: "OTHER" },
                ]}
                required
                value={reason}
              />
              <TextArea label="Justificativa" onChange={setJustification} required value={justification} />
              <label className={cx(adminTheme.softPanel, "flex items-start gap-3 p-4 text-sm font-semibold text-slate-700")}>
                <input checked={releaseBusSeat} className="mt-1" onChange={(event) => setReleaseBusSeat(event.target.checked)} type="checkbox" />
                Liberar vaga de onibus durante a suspensao
              </label>
            </>
          ) : null}

          {action === "reactivate" ? (
            <>
              <LabeledSelect
                label="Onibus opcional"
                onChange={setBusId}
                options={buses.map((bus) => ({
                  label: `${bus.name} - ${bus.availableSeats ?? bus.capacity} vagas`,
                  value: bus.id,
                }))}
                placeholder="Reativar sem selecionar onibus"
                value={busId}
              />
              <Field label="Observacao" onChange={setNote} value={note} />
            </>
          ) : null}

          {action === "terminate" ? (
            <>
              <LabeledSelect
                label="Motivo"
                onChange={setReason}
                options={[
                  { label: "Desistencia", value: "WITHDRAWAL" },
                  { label: "Inadimplencia", value: "NON_PAYMENT" },
                ]}
                required
                value={reason}
              />
              <TextArea label="Justificativa" onChange={setJustification} required value={justification} />
            </>
          ) : null}

          {action === "reinstate" ? (
            <>
              <Field label="Motivo do religamento" onChange={setReason} required value={reason} />
              <StudentAcademicFields
                enrollment={enrollment}
                institutions={institutions}
                setEnrollment={setEnrollment}
                shifts={shifts}
                years={activeYears}
              />
              <LabeledSelect
                label="Onibus opcional"
                onChange={setBusId}
                options={buses.map((bus) => ({
                  label: `${bus.name} - ${bus.availableSeats ?? bus.capacity} vagas`,
                  value: bus.id,
                }))}
                placeholder="Religar sem onibus"
                value={busId}
              />
              <Field label="Observacao" onChange={setNote} value={note} />
            </>
          ) : null}

          {action === "start-board" || action === "update-board-role" ? (
            <>
              <LabeledSelect
                label="Cargo na diretoria"
                onChange={(value) => setBoardRole(value as BoardMemberRole)}
                options={[
                  { label: "Membro", value: "MEMBER" },
                  { label: "Presidente", value: "PRESIDENT" },
                  { label: "Vice-presidente", value: "VICE_PRESIDENT" },
                  { label: "Tesoureiro", value: "TREASURER" },
                  { label: "Secretario", value: "SECRETARY" },
                ]}
                required
                value={boardRole}
              />
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {boardRole === "PRESIDENT"
                  ? "Signatário de documentos: Presidente"
                  : "Usado como signatario dos documentos oficiais quando o cargo for requerido."}
              </p>
              <Field label="Observacao opcional" onChange={setNote} value={note} />
            </>
          ) : null}

          {action === "end-board" ? (
            <Field label="Observacao opcional" onChange={setNote} value={note} />
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className={adminTheme.secondaryButton} disabled={saving} onClick={onClose} type="button">
            Cancelar
          </button>
          <button className={adminTheme.primaryButton} disabled={saving} onClick={() => void submit()} type="button">
            {saving ? "Executando..." : "Confirmar"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TextArea({
  label,
  onChange,
  required,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
      <textarea
        className={cx(adminTheme.control, "mt-1 min-h-24 w-full py-2")}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}

function actionTitle(action: Exclude<StudentProfileAction, "edit">) {
  const titles: Record<Exclude<StudentProfileAction, "edit">, string> = {
    "end-board": "Remover da diretoria",
    reactivate: "Reativar academico",
    reinstate: "Religar academico",
    "start-board": "Adicionar a diretoria",
    suspend: "Suspender academico",
    terminate: "Desligar academico",
    "update-board-role": "Alterar cargo da diretoria",
  };
  return titles[action];
}
