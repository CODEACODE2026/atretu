"use client";

import { Check } from "lucide-react";
import { adminTheme, cx } from "../admin-theme";

export type StudentCreateStep = {
  description: string;
  id: string;
  title: string;
};

export const studentCreateSteps: StudentCreateStep[] = [
  {
    description: "Identificacao, CPF e contato.",
    id: "personal",
    title: "Dados pessoais",
  },
  {
    description: "Endereco administrativo.",
    id: "address",
    title: "Endereco",
  },
  {
    description: "Ano, instituicao, curso e turno.",
    id: "academic",
    title: "Dados academicos",
  },
  {
    description: "Referencia familiar opcional.",
    id: "guardian",
    title: "Responsavel",
  },
  {
    description: "Onibus opcional no cadastro.",
    id: "transport",
    title: "Transporte",
  },
  {
    description: "Conferencia final antes de salvar.",
    id: "review",
    title: "Revisao",
  },
];

export function StudentCreateStepper({
  currentStep,
  highestStep,
  onStepClick,
}: {
  currentStep: number;
  highestStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <nav
      aria-label="Etapas do cadastro"
      className={cx(adminTheme.card, "grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-6")}
    >
      {studentCreateSteps.map((step, index) => {
        const active = index === currentStep;
        const complete = index < currentStep;
        const available = index <= highestStep;
        return (
          <button
            aria-current={active ? "step" : undefined}
            className={cx(
              "group flex min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition duration-150 motion-reduce:transition-none",
              active
                ? "border-[#1F6F5F] bg-[#EEF7F4] shadow-sm"
                : complete
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-slate-200 bg-white hover:border-[#B8D6CF] hover:bg-[#F8FAFA]",
              !available && "cursor-not-allowed opacity-60 hover:border-slate-200",
            )}
            disabled={!available}
            key={step.id}
            onClick={() => onStepClick(index)}
            type="button"
          >
            <span
              className={cx(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-1",
                active
                  ? "bg-[#0F2E2E] text-white ring-[#0F2E2E]"
                  : complete
                    ? "bg-emerald-600 text-white ring-emerald-600"
                    : "bg-slate-50 text-slate-600 ring-slate-200",
              )}
            >
              {complete ? <Check size={14} strokeWidth={2.4} /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-950">
                {step.title}
              </span>
              <span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-slate-500">
                {step.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
