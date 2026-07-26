"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import {
  api,
  type AcademicYear,
  type BaseRecord,
  type BusRecord,
  type StudentPayload,
} from "../../../lib/api";
import { onlyDigits } from "../../../lib/formatters";
import { adminTheme, cx } from "../admin-theme";
import { StudentCreateReview } from "./student-create-review";
import {
  StudentCreateStepper,
  studentCreateSteps,
} from "./student-create-stepper";
import {
  createEmptyEnrollment,
  createEmptyPerson,
  StudentAcademicFields,
  StudentAddressFields,
  StudentGuardianFields,
  StudentPersonalFields,
  StudentTransportFields,
} from "./student-form-fields";

type CreateStepId = (typeof studentCreateSteps)[number]["id"];

export function StudentCreateView({
  institutions,
  onCancel,
  onCreated,
  shifts,
  years,
}: {
  institutions: BaseRecord[];
  onCancel: () => void;
  onCreated: () => Promise<void>;
  shifts: BaseRecord[];
  years: AcademicYear[];
}) {
  const defaultAcademicYearId = useMemo(
    () =>
      years.find((year) => year.isCurrent && year.year >= 2000)?.id ??
      years.find((year) => year.year >= 2000)?.id ??
      years[0]?.id ??
      "",
    [years],
  );
  const [step, setStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [person, setPerson] =
    useState<StudentPayload["person"]>(createEmptyPerson);
  const [guardian, setGuardian] = useState<StudentPayload["guardian"]>();
  const [enrollment, setEnrollment] = useState<StudentPayload["enrollment"]>({
    ...createEmptyEnrollment,
    academicYearId: defaultAcademicYearId,
  });
  const [busId, setBusId] = useState("");
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [busesLoading, setBusesLoading] = useState(false);
  const [busesError, setBusesError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (!enrollment.academicYearId && defaultAcademicYearId) {
      setEnrollment((current) => ({
        ...current,
        academicYearId: defaultAcademicYearId,
      }));
    }
  }, [defaultAcademicYearId, enrollment.academicYearId]);

  useEffect(() => {
    if (!enrollment.academicYearId) {
      setBusId("");
      setBuses([]);
      setBusesError("");
      return;
    }
    void loadBuses(enrollment.academicYearId);
  }, [enrollment.academicYearId]);

  async function loadBuses(academicYearId: string) {
    setBusId("");
    setBusesLoading(true);
    setBusesError("");
    try {
      const response = await api.listBuses({
        status: "active",
        limit: 100,
        sort: "name",
        academicYearId,
      });
      setBuses(response.data.filter((bus) => !bus.isFull));
    } catch (caught) {
      setBuses([]);
      setBusesError(
        caught instanceof Error ? caught.message : "Erro ao carregar onibus",
      );
    } finally {
      setBusesLoading(false);
    }
  }

  function goToStep(nextStep: number) {
    setFormError("");
    setStepErrors([]);
    setStep(nextStep);
  }

  function handleNext() {
    const validation = validateStep(step);
    if (validation.length > 0) {
      setStepErrors(validation);
      setFormError("Revise os campos obrigatorios antes de avancar.");
      return;
    }
    const nextStep = Math.min(step + 1, studentCreateSteps.length - 1);
    setStepErrors([]);
    setFormError("");
    setHighestStep((current) => Math.max(current, nextStep));
    setStep(nextStep);
  }

  function handlePrevious() {
    setFormError("");
    setStepErrors([]);
    setStep((current) => Math.max(current - 1, 0));
  }

  function requestCancel() {
    if (!hasDirtyData()) {
      onCancel();
      return;
    }
    setCancelOpen(true);
  }

  async function handleSave() {
    if (saving) {
      return;
    }
    const allErrors = validateAllSteps();
    if (allErrors.length > 0) {
      const firstInvalidStep = allErrors[0]?.step ?? 0;
      setStep(firstInvalidStep);
      setHighestStep((current) => Math.max(current, firstInvalidStep));
      setStepErrors(allErrors.filter((item) => item.step === firstInvalidStep).map((item) => item.message));
      setFormError("Revise os campos obrigatorios antes de salvar.");
      return;
    }

    setSaving(true);
    setFormError("");
    setStepErrors([]);
    try {
      await api.createStudent({
        person: cleanPerson(person),
        guardian: cleanGuardian(guardian),
        enrollment,
        busId: emptyToUndefined(busId),
      });
      await onCreated();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const currentStep = studentCreateSteps[step]!;
  const finalStep = step === studentCreateSteps.length - 1;

  return (
    <div className="grid gap-5">
      <section
        className={cx(
          adminTheme.card,
          "relative overflow-hidden border-[#C8DAD4] p-5 sm:p-6",
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-[#1F6F5F]"
        />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button
              className={cx(adminTheme.secondaryButton, "mb-4")}
              onClick={requestCancel}
              type="button"
            >
              <ArrowLeft size={16} strokeWidth={2.2} />
              Voltar para listagem
            </button>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
              Cadastro dedicado
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950">
              Novo academico
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Preencha as etapas em ordem. O cadastro so sera enviado na revisao
              final, preservando o contrato atual do modulo Academicos.
            </p>
          </div>
          <div className="rounded-xl border border-[#B8D6CF] bg-[#EEF7F4] px-4 py-3 text-sm font-semibold text-[#14534D]">
            Etapa {step + 1} de {studentCreateSteps.length}
          </div>
        </div>
      </section>

      <StudentCreateStepper
        currentStep={step}
        highestStep={highestStep}
        onStepClick={goToStep}
      />

      {formError ? (
        <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
          {formError}
        </div>
      ) : null}

      {stepErrors.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 shadow-sm">
          <p className="font-semibold">Antes de continuar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {stepErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className={cx(adminTheme.card, "grid gap-5 p-5 sm:p-6")}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
            {currentStep.title}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-normal text-slate-950">
            {currentStep.description}
          </h2>
        </div>
        {renderStep(currentStep.id)}
      </section>

      <div className="flex flex-col-reverse gap-3 rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <button
          className={adminTheme.secondaryButton}
          disabled={saving}
          onClick={requestCancel}
          type="button"
        >
          Cancelar
        </button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className={adminTheme.secondaryButton}
            disabled={saving || step === 0}
            onClick={handlePrevious}
            type="button"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
            Anterior
          </button>
          {finalStep ? (
            <button
              className={adminTheme.primaryButton}
              disabled={saving}
              onClick={() => void handleSave()}
              type="button"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} strokeWidth={2.2} />
              ) : (
                <Save size={16} strokeWidth={2.2} />
              )}
              {saving ? "Salvando..." : "Salvar academico"}
            </button>
          ) : (
            <button
              className={adminTheme.primaryButton}
              disabled={saving}
              onClick={handleNext}
              type="button"
            >
              Proximo
              <ChevronRight size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {cancelOpen ? (
        <CancelCreateDialog
          onClose={() => setCancelOpen(false)}
          onDiscard={() => {
            setCancelOpen(false);
            onCancel();
          }}
        />
      ) : null}
    </div>
  );

  function renderStep(stepId: CreateStepId) {
    switch (stepId) {
      case "personal":
        return <StudentPersonalFields person={person} setPerson={setPerson} />;
      case "address":
        return <StudentAddressFields person={person} setPerson={setPerson} />;
      case "academic":
        return (
          <StudentAcademicFields
            enrollment={enrollment}
            institutions={institutions}
            setEnrollment={setEnrollment}
            shifts={shifts}
            years={years}
          />
        );
      case "guardian":
        return <StudentGuardianFields guardian={guardian} setGuardian={setGuardian} />;
      case "transport":
        return (
          <StudentTransportFields
            busId={busId}
            buses={buses}
            error={busesError}
            loading={busesLoading}
            selectedAcademicYear={Boolean(enrollment.academicYearId)}
            setBusId={setBusId}
          />
        );
      case "review":
        return (
          <StudentCreateReview
            busId={busId}
            buses={buses}
            enrollment={enrollment}
            guardian={guardian}
            institutions={institutions}
            person={person}
            shifts={shifts}
            years={years}
          />
        );
    }
  }

  function hasDirtyData() {
    return Boolean(
      person.fullName ||
        person.cpf ||
        person.rg ||
        person.birthDate ||
        person.phone ||
        person.email ||
        person.addressStreet ||
        person.addressNumber ||
        person.addressNeighborhood ||
        person.addressCity ||
        person.addressZipCode ||
        person.addressState ||
        person.addressComplement ||
        guardian?.fullName ||
        guardian?.cpf ||
        guardian?.rg ||
        enrollment.institutionId ||
        enrollment.shiftId ||
        enrollment.course ||
        enrollment.grade ||
        busId,
    );
  }

  function validateStep(stepIndex: number) {
    const stepId = studentCreateSteps[stepIndex]?.id;
    if (!stepId) {
      return [];
    }
    return validateStepById(stepId);
  }

  function validateStepById(stepId: CreateStepId) {
    const errors: string[] = [];
    if (stepId === "personal") {
      if (!person.fullName.trim()) {
        errors.push("Informe o nome completo.");
      }
      if (onlyDigits(person.cpf).length !== 11) {
        errors.push("Informe um CPF com 11 digitos.");
      }
      if (!person.birthDate) {
        errors.push("Informe a data de nascimento.");
      }
    }
    if (stepId === "address") {
      if (!person.addressStreet.trim()) {
        errors.push("Informe o logradouro.");
      }
      if (!person.addressNumber.trim()) {
        errors.push("Informe o numero.");
      }
      if (!person.addressNeighborhood.trim()) {
        errors.push("Informe o bairro.");
      }
      if (!person.addressCity.trim()) {
        errors.push("Informe a cidade.");
      }
    }
    if (stepId === "academic") {
      if (!enrollment.academicYearId) {
        errors.push("Selecione o ano letivo.");
      }
      const selectedYear = years.find((year) => year.id === enrollment.academicYearId);
      if (selectedYear && selectedYear.year < 2000) {
        errors.push("Selecione um ano letivo operacional a partir de 2000.");
      }
      if (!enrollment.institutionId) {
        errors.push("Selecione a instituicao.");
      }
      if (!enrollment.shiftId) {
        errors.push("Selecione o turno.");
      }
      if (!enrollment.course.trim()) {
        errors.push("Informe o curso.");
      }
      if (!enrollment.grade.trim()) {
        errors.push("Informe a serie.");
      }
    }
    if (stepId === "guardian" && guardian) {
      const hasGuardianData = Boolean(
        guardian.fullName?.trim() || guardian.cpf?.trim() || guardian.rg?.trim(),
      );
      if (hasGuardianData && !guardian.fullName?.trim()) {
        errors.push("Informe o nome do responsavel ou limpe os campos.");
      }
      if (guardian.cpf && onlyDigits(guardian.cpf).length !== 11) {
        errors.push("Informe um CPF de responsavel com 11 digitos.");
      }
    }
    return errors;
  }

  function validateAllSteps() {
    return studentCreateSteps.flatMap((item, index) =>
      validateStepById(item.id).map((message) => ({ message, step: index })),
    );
  }
}

function CancelCreateDialog({
  onClose,
  onDiscard,
}: {
  onClose: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"
      role="dialog"
    >
      <div className={cx(adminTheme.card, "w-full max-w-lg p-5 shadow-2xl")}>
        <p className="text-xs font-semibold uppercase tracking-normal text-[#1F6F5F]">
          Descartar cadastro
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Os dados preenchidos serao perdidos
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Voce iniciou um cadastro de academico. Ao descartar, as informacoes
          preenchidas nesta tela nao serao salvas.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className={adminTheme.secondaryButton} onClick={onClose} type="button">
            Continuar preenchendo
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-red-600 px-3 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-600/20 focus:ring-offset-2"
            onClick={onDiscard}
            type="button"
          >
            Descartar cadastro
          </button>
        </div>
      </div>
    </div>
  );
}

function cleanPerson(person: StudentPayload["person"]): StudentPayload["person"] {
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

function cleanGuardian(
  guardian?: StudentPayload["guardian"],
): StudentPayload["guardian"] | undefined {
  if (!guardian?.fullName) {
    return undefined;
  }
  return {
    ...guardian,
    cpf: emptyToUndefined(onlyDigits(guardian.cpf ?? "")),
    rg: emptyToUndefined(guardian.rg),
  };
}

function emptyToUndefined(value?: string) {
  return value && value.length > 0 ? value : undefined;
}
