"use client";

import { useEffect, useState } from "react";
import type {
  BusAssignmentEvent,
  BusAssignmentRecord,
  BusRecord,
  EnrollmentRecord,
  StudentDetail,
} from "../../../lib/api";
import { api } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { emptyToUndefined } from "./student-profile-utils";

export function StudentTransportTab({
  canManage,
  onChanged,
  onSummary,
  student,
}: {
  canManage: boolean;
  onChanged: () => Promise<void>;
  onSummary: (assignment: BusAssignmentRecord | null) => void;
  student: StudentDetail;
}) {
  return (
    <section className={cx(adminTheme.card, "p-5")}>
      <h2 className="text-base font-semibold text-slate-950">Transporte</h2>
      <p className="mt-1 text-sm text-slate-600">
        Vinculos de onibus por matricula, usando os contratos operacionais atuais.
      </p>
      <div className="mt-4 grid gap-3">
        {student.enrollments.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Nenhuma matricula disponivel para vincular transporte.
          </p>
        ) : (
          student.enrollments.map((enrollment, index) => (
            <BusAssignmentControls
              canManage={canManage}
              enrollment={enrollment}
              key={enrollment.id}
              onChanged={onChanged}
              onSummary={index === 0 ? onSummary : undefined}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BusAssignmentControls({
  canManage,
  enrollment,
  onChanged,
  onSummary,
}: {
  canManage: boolean;
  enrollment: EnrollmentRecord;
  onChanged: () => Promise<void>;
  onSummary?: (assignment: BusAssignmentRecord | null) => void;
}) {
  const [assignment, setAssignment] = useState<BusAssignmentRecord | null>(null);
  const [events, setEvents] = useState<BusAssignmentEvent[]>([]);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [busId, setBusId] = useState("");
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<"release" | "switch" | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadBusState();
  }, [enrollment.id]);

  async function loadBusState() {
    setLoading(true);
    setError("");
    try {
      const [current, eventsResponse, busResponse] = await Promise.all([
        api.getCurrentBusAssignment(enrollment.id),
        api.listBusAssignmentEvents(enrollment.id),
        canManage
          ? api.listBuses({
              status: "active",
              limit: 100,
              sort: "name",
              academicYearId: enrollment.academicYear.id,
            })
          : Promise.resolve({ data: [] }),
      ]);
      setAssignment(current);
      setEvents(eventsResponse.data);
      setBuses(busResponse.data);
      setBusId(current?.bus.id ?? "");
      onSummary?.(current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar onibus");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignOrSwitch() {
    if (!busId) {
      setError("Selecione um onibus.");
      return;
    }
    if (assignment && assignment.bus.id === busId) {
      setError("Selecione um onibus diferente para troca.");
      return;
    }
    if (assignment && confirmAction !== "switch") {
      setConfirmAction("switch");
      return;
    }
    setSaving(true);
    setConfirmAction("");
    setMessage("");
    setError("");
    try {
      if (assignment) {
        await api.switchBus(enrollment.id, {
          newBusId: busId,
          note: emptyToUndefined(note),
        });
        setMessage("Onibus trocado.");
      } else {
        await api.assignBus(enrollment.id, {
          busId,
          note: emptyToUndefined(note),
        });
        setMessage("Onibus vinculado.");
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
    if (!assignment) return;
    if (confirmAction !== "release") {
      setConfirmAction("release");
      return;
    }
    setSaving(true);
    setConfirmAction("");
    setMessage("");
    setError("");
    try {
      await api.releaseBus(enrollment.id, { note: emptyToUndefined(note) });
      setMessage("Vaga liberada.");
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
    <div className={cx(adminTheme.softPanel, "p-4")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">
            {enrollment.academicYear.year} · {enrollment.institution.name}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Onibus atual: {loading ? "carregando..." : assignment?.bus.name ?? "sem vinculo"}
          </p>
        </div>
        {canManage && assignment ? (
          <button
            className={adminTheme.secondaryButton}
            disabled={saving}
            onClick={() => void handleRelease()}
            type="button"
          >
            Liberar vaga
          </button>
        ) : null}
      </div>
      {canManage ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
            <select
              className={cx(adminTheme.control, "w-full")}
              disabled={saving || loading}
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
              className={cx(adminTheme.control, "w-full")}
              disabled={saving}
              maxLength={240}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Observacao opcional"
              value={note}
            />
          </div>
          <button
            className={cx(adminTheme.primaryButton, "mt-3")}
            disabled={saving || loading}
            onClick={() => void handleAssignOrSwitch()}
            type="button"
          >
            {assignment ? "Trocar onibus" : "Vincular onibus"}
          </button>
        </>
      ) : null}
      {events.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            Historico de transporte
          </p>
          <div className="mt-3 grid gap-2">
            {events.slice(0, 5).map((event) => (
              <div
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                key={event.id}
              >
                <p className="font-medium text-slate-900">
                  {busAssignmentEventLabel(event)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(event.occurredAt).toLocaleString("pt-BR")}
                </p>
                {event.note ? (
                  <p className="mt-1 text-xs text-slate-600">{event.note}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      {confirmAction ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            {confirmAction === "switch"
              ? "A troca libera a vaga anterior e ocupa uma vaga no novo onibus."
              : "A vaga sera liberada para outro academico."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={adminTheme.secondaryButton} onClick={() => setConfirmAction("")} type="button">
              Cancelar
            </button>
            <button className={adminTheme.primaryButton} onClick={() => void (confirmAction === "switch" ? handleAssignOrSwitch() : handleRelease())} type="button">
              Confirmar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function busAssignmentEventLabel(event: BusAssignmentEvent) {
  if (event.eventType === "LINKED") {
    return `Vinculado a ${event.toBus?.name ?? "onibus"}`;
  }
  if (event.eventType === "SWITCHED") {
    return `${event.fromBus?.name ?? "Onibus anterior"} para ${
      event.toBus?.name ?? "novo onibus"
    }`;
  }
  if (event.eventType === "RELEASED") {
    return `Liberado de ${event.fromBus?.name ?? "onibus"}`;
  }
  return "Vinculo encerrado automaticamente";
}
