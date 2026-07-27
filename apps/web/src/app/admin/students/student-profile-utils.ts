"use client";

import type {
  EnrollmentRecord,
  StudentHistoryEvent,
  StudentPayload,
  StudentSummary,
} from "../../../lib/api";
import { onlyDigits } from "../../../lib/formatters";

export function emptyToUndefined(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toEnrollmentPayload(
  enrollment: EnrollmentRecord,
): StudentPayload["enrollment"] {
  return {
    academicYearId: enrollment.academicYear.id,
    institutionId: enrollment.institution.id,
    shiftId: enrollment.shift.id,
    course: enrollment.course,
    grade: enrollment.grade,
  };
}

export function cleanPerson(
  person: StudentPayload["person"],
): StudentPayload["person"] {
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

export function cleanGuardian(
  guardian?: StudentPayload["guardian"],
): StudentPayload["guardian"] | undefined {
  if (!guardian?.fullName?.trim()) {
    return undefined;
  }
  return {
    ...guardian,
    fullName: guardian.fullName.trim(),
    cpf: emptyToUndefined(onlyDigits(guardian.cpf ?? "")),
    rg: emptyToUndefined(guardian.rg),
  };
}

export function formatDateInput(value: string) {
  return value.slice(0, 10);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

export function statusLabel(status: StudentSummary["status"]) {
  return status === "ACTIVE"
    ? "Ativo"
    : status === "SUSPENDED"
      ? "Suspenso"
      : "Desligado";
}

export function historyEventLabel(eventType: StudentHistoryEvent["eventType"]) {
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
    BOARD_MEMBERSHIP_STARTED: "Entrada na diretoria",
    BOARD_MEMBERSHIP_ENDED: "Saida da diretoria",
  };
  return labels[eventType];
}

export function reasonLabel(
  reason: NonNullable<StudentHistoryEvent["suspensionReason"]>,
) {
  return reason === "NON_PAYMENT"
    ? "Falta de pagamento"
    : reason === "INFRACTION"
      ? "Infracao"
      : "Outro";
}

export function terminationLabel(
  reason: NonNullable<StudentHistoryEvent["terminationReason"]>,
) {
  return reason === "WITHDRAWAL" ? "Desistencia" : "Inadimplencia";
}

export function revokeObjectUrl(value: string) {
  if (value) {
    URL.revokeObjectURL(value);
  }
}

export function canRenderImage(url: string) {
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
