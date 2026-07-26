"use client";

import type {
  AcademicYear,
  BaseRecord,
  BusRecord,
  StudentPayload,
} from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";

export function StudentCreateReview({
  busId,
  buses,
  enrollment,
  guardian,
  institutions,
  person,
  shifts,
  years,
}: {
  busId: string;
  buses: BusRecord[];
  enrollment: StudentPayload["enrollment"];
  guardian?: StudentPayload["guardian"];
  institutions: BaseRecord[];
  person: StudentPayload["person"];
  shifts: BaseRecord[];
  years: AcademicYear[];
}) {
  const year = years.find((item) => item.id === enrollment.academicYearId);
  const institution = institutions.find((item) => item.id === enrollment.institutionId);
  const shift = shifts.find((item) => item.id === enrollment.shiftId);
  const bus = buses.find((item) => item.id === busId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ReviewBlock
        items={[
          ["Nome", person.fullName],
          ["CPF", person.cpf],
          ["Nascimento", person.birthDate],
          ["Telefone", person.phone],
          ["E-mail", person.email],
        ]}
        title="Dados pessoais"
      />
      <ReviewBlock
        items={[
          ["Logradouro", person.addressStreet],
          ["Numero", person.addressNumber],
          ["Bairro", person.addressNeighborhood],
          ["Cidade", person.addressCity],
          ["UF", person.addressState],
          ["CEP", person.addressZipCode],
          ["Complemento", person.addressComplement],
        ]}
        title="Endereco"
      />
      <ReviewBlock
        items={[
          ["Ano letivo", year?.year ? String(year.year) : ""],
          ["Instituicao", institution?.name],
          ["Curso", enrollment.course],
          ["Serie", enrollment.grade],
          ["Turno", shift?.name],
        ]}
        title="Dados academicos"
      />
      <ReviewBlock
        items={[
          ["Nome", guardian?.fullName],
          ["CPF", guardian?.cpf],
          ["RG", guardian?.rg],
        ]}
        title="Responsavel"
      />
      <ReviewBlock
        className="lg:col-span-2"
        items={[["Onibus", bus?.name ?? "Sem onibus no cadastro"]]}
        title="Transporte"
      />
    </div>
  );
}

function ReviewBlock({
  className,
  items,
  title,
}: {
  className?: string;
  items: Array<[string, string | number | null | undefined]>;
  title: string;
}) {
  return (
    <section className={cx(adminTheme.softPanel, "p-4", className)}>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <dl className="mt-3 grid gap-2">
        {items.map(([label, value]) => (
          <div
            className="grid gap-1 border-t border-slate-200/70 pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[150px_1fr]"
            key={label}
          >
            <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">
              {label}
            </dt>
            <dd className="min-w-0 break-words text-sm font-medium text-slate-900">
              {value || "-"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
