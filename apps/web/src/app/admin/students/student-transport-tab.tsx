"use client";

import { useEffect, useState } from "react";
import type {
  BusAssignmentRecord,
  BusRecord,
  EnrollmentRecord,
  StudentDetail,
} from "../../../lib/api";
import { api } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { emptyToUndefined } from "./student-profile-utils";

export function StudentTransportTab({
  onChanged,
  onSummary,
  student,
}: {
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
  enrollment,
  onChanged,
  onSummary,
}: {
  enrollment: EnrollmentRecord;
  onChanged: () => Promise<void>;
  onSummary?: (assignment: BusAssignmentRecord | null) => void;
}) {
  const [assignment, setAssignment] = useState<BusAssignmentRecord | null>(null);
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
        {assignment ? (
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
