"use client";

import { useEffect, useState } from "react";
import type {
  AcademicYear,
  BaseRecord,
  EnrollmentRecord,
  StudentDetail,
  StudentPayload,
} from "../../../lib/api";
import { api } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { StudentAcademicFields } from "./student-form-fields";
import { toEnrollmentPayload } from "./student-profile-utils";

export function StudentAcademicTab({
  institutions,
  onChanged,
  shifts,
  student,
  years,
}: {
  institutions: BaseRecord[];
  onChanged: () => Promise<void>;
  shifts: BaseRecord[];
  student: StudentDetail;
  years: AcademicYear[];
}) {
  const currentEnrollment = student.enrollments[0];
  const [enrollment, setEnrollment] = useState<StudentPayload["enrollment"]>(() =>
    currentEnrollment
      ? toEnrollmentPayload(currentEnrollment)
      : {
          academicYearId: "",
          institutionId: "",
          shiftId: "",
          course: "",
          grade: "",
        },
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (currentEnrollment) {
      setEnrollment(toEnrollmentPayload(currentEnrollment));
    }
  }, [currentEnrollment?.id]);

  async function saveEnrollment() {
    if (!currentEnrollment) {
      setError("Matricula atual obrigatoria para edicao.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.updateEnrollment(student.id, currentEnrollment.id, enrollment);
      setMessage("Matricula atualizada.");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <section className={cx(adminTheme.card, "grid gap-5 p-5")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Matricula atual
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Edicao dos dados academicos ja existentes, sem criar contratos novos.
            </p>
          </div>
          <button
            className={adminTheme.primaryButton}
            disabled={saving || !currentEnrollment}
            onClick={() => void saveEnrollment()}
            type="button"
          >
            {saving ? "Salvando..." : "Salvar matricula"}
          </button>
        </div>
        {currentEnrollment ? (
          <StudentAcademicFields
            enrollment={enrollment}
            institutions={institutions}
            setEnrollment={setEnrollment}
            shifts={shifts}
            years={years}
          />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Nenhuma matricula encontrada para este academico.
          </p>
        )}
      </section>

      <section className={cx(adminTheme.card, "p-5")}>
        <h2 className="text-base font-semibold text-slate-950">Historico de matriculas</h2>
        <div className="mt-4 grid gap-3">
          {student.enrollments.map((item) => (
            <EnrollmentItem enrollment={item} key={item.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EnrollmentItem({ enrollment }: { enrollment: EnrollmentRecord }) {
  return (
    <div className={cx(adminTheme.softPanel, "p-4")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-950">
            {enrollment.academicYear.year} · {enrollment.institution.name}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {enrollment.course} · Serie {enrollment.grade} · {enrollment.shift.name}
          </p>
        </div>
        <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          {enrollment.status}
        </span>
      </div>
    </div>
  );
}
