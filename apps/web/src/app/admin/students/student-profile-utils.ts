"use client";

import type {
  EnrollmentRecord,
  StudentHistoryEvent,
  StudentPayload,
  StudentSummary,
} from "../../../lib/api";
import { onlyDigits } from "../../../lib/formatters";

export const STUDENT_HISTORY_PAGE_SIZE = 20;

export type StudentHistoryCategory =
  | "all"
  | "finance"
  | "cards"
  | "documents"
  | "academic";

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

export function historyEventCategory(
  eventType: StudentHistoryEvent["eventType"],
): Exclude<StudentHistoryCategory, "all"> {
  if (
    eventType === "INVOICE_CREATED" ||
    eventType === "INVOICE_CANCELLED" ||
    eventType === "BANK_SLIP_ISSUED" ||
    eventType === "BANK_SLIP_PAYMENT_CONFIRMED" ||
    eventType === "BANK_SLIP_CANCELLATION_REQUESTED" ||
    eventType === "BANK_SLIP_CANCELLED" ||
    eventType === "MANUAL_FINANCIAL_INCOME_RECORDED"
  ) {
    return "finance";
  }
  if (
    eventType === "STUDENT_CARD_ISSUED" ||
    eventType === "STUDENT_CARD_INVALIDATED"
  ) {
    return "cards";
  }
  if (
    eventType === "OFFICIAL_DOCUMENT_ISSUED" ||
    eventType === "OFFICIAL_DOCUMENT_INVALIDATED"
  ) {
    return "documents";
  }
  return "academic";
}

export function filterStudentHistoryEvents(
  events: StudentHistoryEvent[],
  category: StudentHistoryCategory,
) {
  if (category === "all") {
    return events;
  }
  return events.filter((event) => historyEventCategory(event.eventType) === category);
}

export function getVisibleStudentHistoryEvents(
  events: StudentHistoryEvent[],
  category: StudentHistoryCategory,
  visibleCount: number,
) {
  return filterStudentHistoryEvents(events, category).slice(0, visibleCount);
}

export function groupStudentHistoryEventsByMonth(events: StudentHistoryEvent[]) {
  const groups = new Map<string, { key: string; label: string; events: StudentHistoryEvent[] }>();
  for (const event of events) {
    const date = new Date(event.occurredAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(date);
    const normalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
    const group = groups.get(key) ?? { key, label: normalizedLabel, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

export function historyEventDescription(event: StudentHistoryEvent) {
  if (event.justification) {
    return event.justification;
  }
  if (event.suspensionReason) {
    return `Motivo: ${reasonLabel(event.suspensionReason)}`;
  }
  if (event.terminationReason) {
    return `Tipo: ${terminationLabel(event.terminationReason)}`;
  }
  if (event.bus) {
    return `Onibus: ${event.bus.name}`;
  }
  if (event.boardMembership?.role) {
    return `Cargo: ${boardMemberRoleLabel(event.boardMembership.role)}`;
  }
  if (event.officialDocumentIssue?.protocol) {
    return `Protocolo: ${event.officialDocumentIssue.protocol}`;
  }
  return "";
}

export function historyEventDetails(event: StudentHistoryEvent) {
  const details: string[] = [];
  if (isLegacySuspensionWithoutBus(event)) {
    details.push("Onibus: nao informado no legado");
  } else if (
    event.busSeatReleased !== null &&
    event.busSeatReleased !== undefined
  ) {
    details.push(
      `Vaga de onibus: ${event.busSeatReleased ? "liberada" : "mantida"}`,
    );
  }
  if (event.bus && historyEventDescription(event) !== `Onibus: ${event.bus.name}`) {
    details.push(`Onibus: ${event.bus.name}`);
  }
  if (event.busAssignment?.bus?.name) {
    details.push(`Atribuicao: ${event.busAssignment.bus.name}`);
  }
  if (event.boardMembership?.role) {
    details.push(`Cargo na diretoria: ${boardMemberRoleLabel(event.boardMembership.role)}`);
  }
  if (event.boardMembership?.status) {
    details.push(`Status da diretoria: ${event.boardMembership.status}`);
  }
  if (event.officialDocumentIssue?.protocol) {
    details.push(`Protocolo: ${event.officialDocumentIssue.protocol}`);
  }
  if (event.officialDocumentIssue?.status) {
    details.push(
      `Status do documento: ${
        event.officialDocumentIssue.status === "INVALIDATED"
          ? "Invalidado"
          : "Válido"
      }`,
    );
  }
  return details;
}

function isLegacySuspensionWithoutBus(event: StudentHistoryEvent) {
  return (
    event.eventType === "STUDENT_SUSPENDED" &&
    event.justification?.startsWith("Academico importado via LEGACY") &&
    !event.bus &&
    !event.busAssignment
  );
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
  if (reason === "WITHDRAWAL") return "Desistencia";
  if (reason === "COURSE_COMPLETION") return "Termino do curso";
  if (reason === "UNSPECIFIED") return "Nao informado no legado";
  return "Inadimplencia";
}

function boardMemberRoleLabel(role: NonNullable<StudentHistoryEvent["boardMembership"]>["role"]) {
  const labels = {
    PRESIDENT: "Presidente",
    VICE_PRESIDENT: "Vice-presidente",
    TREASURER: "Tesoureiro",
    SECRETARY: "Secretario",
    MEMBER: "Membro",
  } satisfies Record<NonNullable<typeof role>, string>;
  return role ? labels[role] : "";
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
