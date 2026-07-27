"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { StudentDetail, StudentPayload } from "../../../lib/api";
import { api } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import {
  StudentAddressFields,
  StudentGuardianFields,
  StudentPersonalFields,
} from "./student-form-fields";
import {
  cleanGuardian,
  cleanPerson,
  formatDateInput,
} from "./student-profile-utils";
import { maskCpf } from "../../../lib/formatters";

export function StudentPersonalTab({
  onChanged,
  student,
}: {
  onChanged: () => Promise<void>;
  student: StudentDetail;
}) {
  const [person, setPerson] = useState<StudentPayload["person"]>(() =>
    toPersonPayload(student),
  );
  const [guardian, setGuardian] = useState<StudentPayload["guardian"] | undefined>(
    () => toGuardianPayload(student),
  );
  const [saving, setSaving] = useState<"guardian" | "person" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setPerson(toPersonPayload(student));
    setGuardian(toGuardianPayload(student));
  }, [student.id, student.updatedAt]);

  async function savePerson() {
    setSaving("person");
    setMessage("");
    setError("");
    try {
      await api.updateStudentPerson(student.id, cleanPerson(person));
      setMessage("Dados pessoais atualizados.");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving("");
    }
  }

  async function saveGuardian() {
    setSaving("guardian");
    setMessage("");
    setError("");
    try {
      await api.updateStudentGuardian(
        student.id,
        guardian?.fullName
          ? { guardian: cleanGuardian(guardian)! }
          : { clear: true },
      );
      setMessage("Responsavel atualizado.");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao atualizar");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="grid gap-4">
      <Messages error={error} message={message} />
      <section className={cx(adminTheme.card, "grid gap-5 p-5")}>
        <SectionTitle
          action={
            <button
              className={adminTheme.primaryButton}
              disabled={saving !== ""}
              onClick={() => void savePerson()}
              type="button"
            >
              {saving === "person" ? "Salvando..." : "Salvar dados"}
            </button>
          }
          title="Dados pessoais e endereco"
        />
        <StudentPersonalFields person={person} setPerson={setPerson} />
        <StudentAddressFields person={person} setPerson={setPerson} />
      </section>

      <section className={cx(adminTheme.card, "grid gap-5 p-5")}>
        <SectionTitle
          action={
            <button
              className={adminTheme.primaryButton}
              disabled={saving !== ""}
              onClick={() => void saveGuardian()}
              type="button"
            >
              {saving === "guardian" ? "Salvando..." : "Salvar responsavel"}
            </button>
          }
          title="Responsavel"
        />
        <StudentGuardianFields guardian={guardian} setGuardian={setGuardian} />
      </section>
    </div>
  );
}

function SectionTitle({
  action,
  title,
}: {
  action: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {action}
    </div>
  );
}

function Messages({ error, message }: { error: string; message: string }) {
  return (
    <>
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
    </>
  );
}

function toPersonPayload(student: StudentDetail): StudentPayload["person"] {
  return {
    fullName: student.person.fullName,
    cpf: maskCpf(student.person.cpf),
    rg: student.person.rg ?? "",
    birthDate: formatDateInput(student.person.birthDate),
    phone: student.person.phone ?? "",
    email: student.person.email ?? "",
    addressStreet: student.person.addressStreet,
    addressNumber: student.person.addressNumber,
    addressNeighborhood: student.person.addressNeighborhood,
    addressCity: student.person.addressCity,
    addressZipCode: student.person.addressZipCode ?? "",
    addressState: student.person.addressState ?? "",
    addressComplement: student.person.addressComplement ?? "",
  };
}

function toGuardianPayload(
  student: StudentDetail,
): StudentPayload["guardian"] | undefined {
  return student.guardian
    ? {
        fullName: student.guardian.fullName,
        cpf: maskCpf(student.guardian.cpf ?? ""),
        rg: student.guardian.rg ?? "",
      }
    : undefined;
}
