"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AcademicYear,
  ApiUser,
  BaseRecord,
  BusAssignmentRecord,
  StudentDetail,
} from "../../../lib/api";
import { api } from "../../../lib/api";
import {
  canAccessOperationalAdmin,
  hasCapability,
} from "../../../lib/auth";
import { StudentInvoicesForStudent } from "../finance-panel";
import { StudentCardsForStudent } from "../student-cards-panel";
import { adminTheme, cx } from "../admin-theme";
import { StudentAcademicTab } from "./student-academic-tab";
import { StudentActionDialog } from "./student-action-dialogs";
import { StudentDocumentsTab } from "./student-documents";
import { StudentHistoryTab } from "./student-history-tab";
import { StudentPersonalTab } from "./student-personal-tab";
import {
  StudentProfileHeader,
  type StudentProfileAction,
} from "./student-profile-header";
import { StudentProfileOverview } from "./student-profile-overview";
import { StudentProfileSummary } from "./student-profile-summary";
import {
  StudentProfileTabs,
  type StudentProfileTab,
} from "./student-profile-tabs";
import { StudentTransportTab } from "./student-transport-tab";
import {
  buildStudentCardProfileSummary,
  emptyStudentCardProfileSummary,
  type StudentCardProfileSummary,
} from "./cards/student-card-display-utils";

export function StudentProfileView({
  institutions,
  onBack,
  onChanged,
  shifts,
  studentId,
  user,
  years,
}: {
  institutions: BaseRecord[];
  onBack: () => void;
  onChanged: () => Promise<void>;
  shifts: BaseRecord[];
  studentId: string;
  user: ApiUser;
  years: AcademicYear[];
}) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [activeTab, setActiveTab] = useState<StudentProfileTab>("overview");
  const [loadedTabs, setLoadedTabs] = useState<Set<StudentProfileTab>>(
    () => new Set(["overview"]),
  );
  const [summaryTransport, setSummaryTransport] =
    useState<BusAssignmentRecord | null>(null);
  const [cardSummary, setCardSummary] = useState<StudentCardProfileSummary>(
    emptyStudentCardProfileSummary,
  );
  const [documentSummary, setDocumentSummary] =
    useState<{ active: number; missing: number }>();
  const [action, setAction] =
    useState<Exclude<StudentProfileAction, "edit"> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUseLegacyProfileTabs = canAccessOperationalAdmin(user);
  const canViewOfficialDocuments = hasCapability(user, "officialDocuments.view");
  const canViewStudentCards = hasCapability(user, "studentCards.view");
  const canUpdateStudent = hasCapability(user, "students.update");
  const canChangeStudentStatus = hasCapability(user, "students.changeStatus");
  const canManageBoard = hasCapability(user, "students.board.manage");
  const canUpdateBoardRole = user.roles.includes("SUPER_ADMIN");
  const visibleTabs: StudentProfileTab[] = canUseLegacyProfileTabs
    ? [
        "overview",
        "academic",
        "finance",
        "documents",
        "transport",
        "cards",
        "history",
        "personal",
      ]
    : [
        "overview",
        "academic",
        "history",
        ...(canViewOfficialDocuments ? (["documents"] as const) : []),
        ...(canViewStudentCards ? (["cards"] as const) : []),
        ...(canUpdateStudent ? (["personal"] as const) : []),
      ];

  useEffect(() => {
    void loadStudent();
  }, [studentId]);

  useEffect(() => {
    setLoadedTabs((current) => new Set(current).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (!student?.enrollments[0]?.id) {
      setSummaryTransport(null);
      return;
    }
    void loadSummaryTransport(student.enrollments[0].id);
  }, [student?.id, student?.enrollments[0]?.id]);

  async function loadStudent() {
    setLoading(true);
    setError("");
    try {
      const detail = await api.getStudent(studentId);
      setStudent(detail);
      await loadCardSummary(detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao abrir perfil");
      setCardSummary((current) => ({ ...current, loading: false }));
    } finally {
      setLoading(false);
    }
  }

  async function loadCardSummary(detail: StudentDetail) {
    setCardSummary((current) => ({ ...current, loading: true }));
    if (!canViewStudentCards) {
      setCardSummary({
        activeCard: null,
        historyCount: 0,
        loading: false,
        pendingRequirement: null,
        totalCards: 0,
      });
      return;
    }
    try {
      const response = await api.listStudentCardsForStudent(detail.id);
      setCardSummary(buildStudentCardProfileSummary(detail, response.data));
    } catch {
      setCardSummary({
        activeCard: null,
        historyCount: 0,
        loading: false,
        pendingRequirement: null,
        totalCards: 0,
      });
    }
  }

  async function loadSummaryTransport(enrollmentId: string) {
    try {
      setSummaryTransport(await api.getCurrentBusAssignment(enrollmentId));
    } catch {
      setSummaryTransport(null);
    }
  }

  async function refreshStudent(nextMessage?: string) {
    await loadStudent();
    await onChanged();
    if (nextMessage) {
      setMessage(nextMessage);
    }
  }

  function changeTab(tab: StudentProfileTab) {
    if (!visibleTabs.includes(tab)) {
      return;
    }
    setActiveTab(tab);
    setMessage("");
    setError("");
  }

  function handleAction(nextAction: StudentProfileAction) {
    setMenuOpen(false);
    if (nextAction === "edit") {
      if (!canUpdateStudent) {
        return;
      }
      changeTab("personal");
      return;
    }
    if (
      (nextAction === "suspend" ||
        nextAction === "reactivate" ||
        nextAction === "terminate" ||
        nextAction === "reinstate") &&
      !canChangeStudentStatus
    ) {
      return;
    }
    if (
      (nextAction === "start-board" || nextAction === "end-board") &&
      !canManageBoard
    ) {
      return;
    }
    if (nextAction === "update-board-role" && !canUpdateBoardRole) {
      return;
    }
    setAction(nextAction);
  }

  const hiddenTabs = useMemo(() => {
    const tabs: StudentProfileTab[] = [
      "overview",
      "academic",
      "finance",
      "documents",
      "transport",
      "cards",
      "history",
      "personal",
    ];
    return tabs.filter((tab) => loadedTabs.has(tab) && visibleTabs.includes(tab));
  }, [loadedTabs, visibleTabs]);

  if (loading && !student) {
    return (
      <div className={cx(adminTheme.card, "p-6 text-sm text-slate-500")}>
        Carregando perfil do academico...
      </div>
    );
  }

  if (!student) {
    return (
      <section className={cx(adminTheme.card, "grid gap-4 p-6")}>
        <p className="text-sm text-red-700">
          {error || "Nao foi possivel abrir o perfil."}
        </p>
        <button className={adminTheme.secondaryButton} onClick={onBack} type="button">
          Voltar para listagem
        </button>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <StudentProfileHeader
        activeCard={cardSummary.activeCard}
        canBoardManage={canManageBoard}
        canChangeStatus={canChangeStudentStatus}
        canUpdate={canUpdateStudent}
        canUpdateBoardRole={canUpdateBoardRole}
        menuOpen={menuOpen}
        onAction={handleAction}
        onBack={onBack}
        onToggleMenu={() => setMenuOpen((current) => !current)}
        pendingRequirement={cardSummary.pendingRequirement}
        student={student}
      />
      <StudentProfileSummary
        cardSummary={cardSummary}
        documentSummary={documentSummary}
        student={student}
        transport={summaryTransport}
      />
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
      <StudentProfileTabs
        activeTab={activeTab}
        loadedTabs={loadedTabs}
        onChange={changeTab}
        tabs={visibleTabs}
      />
      <div className="grid min-w-0 gap-4">
        {hiddenTabs.map((tab) => (
          <div className="min-w-0" hidden={tab !== activeTab} key={tab}>
            {tab === "overview" ? (
              <StudentProfileOverview onOpenTab={changeTab} student={student} />
            ) : null}
            {tab === "academic" ? (
              <StudentAcademicTab
                canUpdate={canUpdateStudent}
                institutions={institutions}
                onChanged={() => refreshStudent("Dados academicos atualizados.")}
                shifts={shifts}
                student={student}
                years={years}
              />
            ) : null}
            {tab === "finance" ? (
              <section className={cx(adminTheme.card, "p-5")}>
                <StudentInvoicesForStudent
                  onChanged={() => refreshStudent("Financeiro atualizado.")}
                  student={student}
                  user={user}
                />
              </section>
            ) : null}
            {tab === "documents" ? (
              <StudentDocumentsTab
                onChanged={() => refreshStudent("Documentos atualizados.")}
                onSummary={setDocumentSummary}
                showLegacyDocuments={canUseLegacyProfileTabs}
                showOfficialDocuments={canViewOfficialDocuments}
                studentId={student.id}
                studentName={student.person.fullName}
                user={user}
              />
            ) : null}
            {tab === "transport" ? (
              <StudentTransportTab
                onChanged={() => refreshStudent("Transporte atualizado.")}
                onSummary={setSummaryTransport}
                student={student}
              />
            ) : null}
            {tab === "cards" ? (
              <section className={cx(adminTheme.card, "p-5")}>
                <StudentCardsForStudent
                  activeCard={cardSummary.activeCard}
                  disableInvalidation
                  onChanged={() => refreshStudent("Carteirinhas atualizadas.")}
                  student={student}
                  user={user}
                />
              </section>
            ) : null}
            {tab === "history" ? <StudentHistoryTab studentId={student.id} /> : null}
            {tab === "personal" ? (
              <StudentPersonalTab
                onChanged={() => refreshStudent("Dados cadastrais atualizados.")}
                student={student}
              />
            ) : null}
          </div>
        ))}
      </div>
      {action ? (
        <StudentActionDialog
          action={action}
          institutions={institutions}
          onClose={() => setAction(null)}
          onDone={async (nextMessage) => {
            setAction(null);
            await refreshStudent(nextMessage);
          }}
          shifts={shifts}
          student={student}
          years={years}
        />
      ) : null}
    </div>
  );
}
