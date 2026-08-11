import type { StudentCardRecord, StudentDetail } from "../../../../lib/api";

export type StudentCardProfileSummary = {
  activeCard: StudentCardRecord | null;
  historyCount: number;
  loading: boolean;
  pendingRequirement: StudentCardRequirement | null;
  totalCards: number;
};

export type StudentCardRequirement = {
  cardType: StudentCardRecord["cardType"];
  enrollment: StudentDetail["enrollments"][number];
};

export function emptyStudentCardProfileSummary(): StudentCardProfileSummary {
  return {
    activeCard: null,
    historyCount: 0,
    loading: true,
    pendingRequirement: null,
    totalCards: 0,
  };
}

export function buildStudentCardProfileSummary(
  student: StudentDetail,
  cards: StudentCardRecord[],
): StudentCardProfileSummary {
  const activeCard = selectCurrentStudentCard(student, cards);
  return {
    activeCard,
    historyCount: cards.filter((card) => card.id !== activeCard?.id).length,
    loading: false,
    pendingRequirement: selectPendingStudentCardRequirement(
      student,
      cards,
      activeCard,
    ),
    totalCards: cards.length,
  };
}

export function selectCurrentStudentCard(
  student: StudentDetail,
  cards: StudentCardRecord[],
) {
  const currentEnrollment = student.enrollments[0];
  if (!currentEnrollment) {
    return null;
  }
  return (
    cards.find(
      (card) =>
        card.status === "ACTIVE" &&
        card.validity.usable &&
        card.cardType === expectedStudentCardType(student) &&
        card.enrollment.id === currentEnrollment.id &&
        card.academicYear.id === currentEnrollment.academicYear.id,
    ) ?? null
  );
}

export function selectPendingStudentCardRequirement(
  student: StudentDetail,
  cards: StudentCardRecord[],
  activeCard = selectCurrentStudentCard(student, cards),
): StudentCardRequirement | null {
  const currentEnrollment = student.enrollments[0];
  if (
    activeCard ||
    !currentEnrollment ||
    currentEnrollment.status !== "ACTIVE" ||
    student.status !== "ACTIVE"
  ) {
    return null;
  }
  return {
    cardType: expectedStudentCardType(student),
    enrollment: currentEnrollment,
  };
}

export function expectedStudentCardType(
  student: StudentDetail,
): StudentCardRecord["cardType"] {
  return student.activeBoardMembership ? "BOARD_MEMBER" : "STUDENT";
}

export function cardTypeLabel(type: StudentCardRecord["cardType"]) {
  return type === "BOARD_MEMBER" ? "Diretoria" : "Acadêmico";
}

export function cardStatusLabel(card: StudentCardRecord) {
  if (card.status === "INVALIDATED") {
    return "Invalidada";
  }
  if (!card.validity.usable) {
    return validityReasonLabel(card.validity.reason);
  }
  return "Ativa";
}

export function cardStatusBadgeClass(card: StudentCardRecord) {
  const base = "inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold";
  if (card.status === "ACTIVE" && card.validity.usable) {
    return `${base} bg-emerald-50 text-emerald-700`;
  }
  if (card.status === "INVALIDATED") {
    return `${base} bg-slate-100 text-slate-700`;
  }
  return `${base} bg-amber-50 text-amber-700`;
}

export function usabilityLabel(card: StudentCardRecord) {
  return card.validity.usable ? "Utilizável" : validityReasonLabel(card.validity.reason);
}

export function validityReasonLabel(reason?: string | null) {
  const labels: Record<string, string> = {
    BOARD_MEMBERSHIP_ACTIVE_REQUIRES_BOARD_CARD: "Substituída",
    BOARD_MEMBERSHIP_ENDED: "Diretoria encerrada",
    CARD_INVALIDATED: "Invalidada",
    STUDENT_SUSPENDED: "Acadêmico suspenso",
    STUDENT_TERMINATED: "Acadêmico desligado",
  };
  return reason ? labels[reason] ?? "Não utilizável" : "Não utilizável";
}

export function invalidationReasonLabel(reason?: StudentCardRecord["invalidationReason"]) {
  const labels: Record<string, string> = {
    BOARD_MEMBERSHIP_ENDED: "Fim de participação na diretoria",
    MANUAL_CORRECTION: "Correção administrativa",
    OTHER: "Outro motivo",
    STUDENT_TERMINATED: "Acadêmico desligado",
    SUPERSEDED_BY_BOARD_CARD: "Substituída por carteirinha de diretoria",
  };
  return reason ? labels[reason] ?? "Motivo não informado" : "Motivo não informado";
}
