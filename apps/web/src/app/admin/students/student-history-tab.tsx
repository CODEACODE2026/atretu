"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileText,
  GraduationCap,
  IdCard,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { StudentHistoryEvent } from "../../../lib/api";
import { api } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import {
  formatDateTime,
  getVisibleStudentHistoryEvents,
  groupStudentHistoryEventsByMonth,
  historyEventCategory,
  historyEventDescription,
  historyEventDetails,
  historyEventLabel,
  STUDENT_HISTORY_PAGE_SIZE,
  type StudentHistoryCategory,
} from "./student-profile-utils";

const historyFilters: Array<{
  key: StudentHistoryCategory;
  label: string;
  icon: typeof BookOpen;
}> = [
  { key: "all", label: "Todos", icon: BookOpen },
  { key: "finance", label: "Financeiro", icon: CircleDollarSign },
  { key: "cards", label: "Carteirinhas", icon: IdCard },
  { key: "documents", label: "Documentos", icon: FileText },
  { key: "academic", label: "Academico", icon: GraduationCap },
];

export function StudentHistoryTab({ studentId }: { studentId: string }) {
  const [events, setEvents] = useState<StudentHistoryEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState<StudentHistoryCategory>("all");
  const [visibleCount, setVisibleCount] = useState(STUDENT_HISTORY_PAGE_SIZE);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadHistory();
  }, [studentId]);

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listStudentHistory(studentId);
      setEvents(response.data);
      setLoaded(true);
      setVisibleCount(STUDENT_HISTORY_PAGE_SIZE);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar historico");
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = events.filter(
    (event) => activeFilter === "all" || historyEventCategory(event.eventType) === activeFilter,
  );
  const visibleEvents = getVisibleStudentHistoryEvents(
    events,
    activeFilter,
    visibleCount,
  );
  const groupedEvents = groupStudentHistoryEventsByMonth(visibleEvents);
  const hasMore = visibleEvents.length < filteredEvents.length;

  function selectFilter(filter: StudentHistoryCategory) {
    setActiveFilter(filter);
    setVisibleCount(STUDENT_HISTORY_PAGE_SIZE);
  }

  return (
    <section className={cx(adminTheme.card, "p-5")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Historico funcional
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Eventos operacionais registrados para este academico.
          </p>
        </div>
        <button className={adminTheme.secondaryButton} disabled={loading} onClick={() => void loadHistory()} type="button">
          Atualizar
        </button>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {historyFilters.map((filter) => {
          const Icon = filter.icon;
          const count =
            filter.key === "all"
              ? events.length
              : events.filter((event) => historyEventCategory(event.eventType) === filter.key).length;
          const active = activeFilter === filter.key;
          return (
            <button
              className={cx(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition",
                active
                  ? "border-[#0F2E2E] bg-[#0F2E2E] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#8DB7AD] hover:bg-[#F2F8F6] hover:text-[#0F2E2E]",
                count === 0 && !active ? "opacity-60" : null,
              )}
              disabled={loading}
              key={filter.key}
              onClick={() => selectFilter(filter.key)}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{filter.label}</span>
              <span className={cx(active ? "text-white/75" : "text-slate-400")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-4">
        {loading && !loaded ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Carregando historico...
          </p>
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Nenhum evento funcional registrado.
          </p>
        ) : visibleEvents.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Nenhum evento nesta categoria.
          </p>
        ) : (
          <>
            {groupedEvents.map((group) => (
              <div className="grid gap-2" key={group.key}>
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
                  {group.label}
                </p>
                <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {group.events.map((event) => (
                    <HistoryItem event={event} key={event.id} />
                  ))}
                </div>
              </div>
            ))}
            {hasMore ? (
              <button
                className={cx(adminTheme.secondaryButton, "w-full")}
                onClick={() => setVisibleCount((current) => current + STUDENT_HISTORY_PAGE_SIZE)}
                type="button"
              >
                Carregar mais
                <span className="text-slate-400">
                  {visibleEvents.length}/{filteredEvents.length}
                </span>
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function HistoryItem({ event }: { event: StudentHistoryEvent }) {
  const [expanded, setExpanded] = useState(false);
  const description = historyEventDescription(event);
  const details = historyEventDetails(event);
  const Icon = historyIcon(event);

  return (
    <article
      className="min-w-0 border-b border-slate-100 px-3 py-2 last:border-b-0 sm:px-4"
      data-history-event-row="true"
    >
      <div className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] gap-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:items-start">
        <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {historyEventLabel(event.eventType)}
          </p>
          {description ? (
            <p className="mt-0.5 truncate text-xs text-slate-600">{description}</p>
          ) : null}
          {details.length > 0 ? (
            <div className="mt-1">
              <button
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6F5F] hover:text-[#0F2E2E]"
                onClick={() => setExpanded((current) => !current)}
                type="button"
              >
                {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                {expanded ? (
                  <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </button>
              {expanded ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {details.map((detail) => (
                    <span
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                      key={detail}
                    >
                      {detail}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <time className="col-start-2 text-xs text-slate-500 sm:col-start-auto sm:pt-1 sm:text-right">
          {formatDateTime(event.occurredAt)}
        </time>
      </div>
    </article>
  );
}

function historyIcon(event: StudentHistoryEvent) {
  const category = historyEventCategory(event.eventType);
  if (category === "finance") {
    return CircleDollarSign;
  }
  if (category === "cards") {
    return IdCard;
  }
  if (category === "documents") {
    return FileText;
  }
  return GraduationCap;
}
