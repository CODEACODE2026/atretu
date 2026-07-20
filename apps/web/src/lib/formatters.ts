export type PromptOption<T extends string> = {
  label: string;
  value: T;
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2");
  }
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  }
  return digits.replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3");
}

export function promptOption<T extends string>(
  title: string,
  options: Array<PromptOption<T>>,
) {
  const choice = window.prompt(
    `${title}\n${options
      .map((option, index) => `${index + 1}. ${option.label}`)
      .join("\n")}\n\nDigite o numero da opcao.`,
  );
  if (!choice) {
    return null;
  }
  return options[Number(choice) - 1]?.value ?? null;
}

export function translateStatus(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    INACTIVE: "Inativo",
    ARCHIVED: "Arquivado",
    SUSPENDED: "Suspenso",
    TERMINATED: "Desligado",
    PENDING: "Pendente",
    APPROVED: "Aprovado",
    REJECTED: "Rejeitado",
    OPEN: "Aberta",
    ISSUED: "Emitido",
    PAID: "Pago",
    CANCELLED: "Cancelado",
    UNKNOWN: "Situacao incerta",
    RELEASED: "Vaga liberada",
    SWITCHED: "Onibus trocado",
  };
  return labels[status] ?? status;
}

export function translateReason(reason: string) {
  const labels: Record<string, string> = {
    NON_PAYMENT: "Inadimplencia",
    INFRACTION: "Infracao",
    WITHDRAWAL: "Desistencia",
    MANUAL_CORRECTION: "Correcao administrativa",
    DUPLICATE: "Registro duplicado",
    OTHER: "Outro motivo",
    BOARD_MEMBERSHIP_ENDED: "Fim de participacao na diretoria",
    STUDENT_TERMINATED: "Academico desligado",
  };
  return labels[reason] ?? reason;
}

export function mapApiErrorMessage(message?: string) {
  const text = message?.trim();
  if (!text) {
    return "Nao foi possivel concluir a operacao.";
  }

  const mappings: Array<[RegExp, string]> = [
    [
      /PDF_NOT_ARCHIVED_BEFORE_SETTLEMENT|PDF oficial nao foi armazenado|PDF oficial não foi armazenado/i,
      "O boleto foi pago, mas o PDF oficial não foi armazenado antes da liquidação e não está mais disponível no Sicredi.",
    ],
    [/ACADEMIC_YEAR_NOT_ACTIVE|ACADEMIC_YEAR_ARCHIVED/i, "Ano Letivo arquivado nao pode ser usado neste fluxo."],
    [/ACADEMIC_YEAR_CURRENT_CANNOT_ARCHIVE/i, "Ano Letivo atual nao pode ser arquivado."],
    [/ACADEMIC_YEAR_(CANNOT_DELETE|HAS_DEPENDENCIES)/i, "Este registro possui dependencias e nao pode ser excluido."],
    [/ACADEMIC_YEAR_CANNOT_EDIT/i, "Ano Letivo com registros vinculados nao pode ter o ano alterado."],
    [/ACADEMIC_YEAR_ALREADY_ARCHIVED/i, "Ano Letivo ja esta arquivado."],
    [/ACADEMIC_YEAR_ALREADY_ACTIVE/i, "Ano Letivo ja esta ativo."],
    [/onibus.*lotado|sem vaga|capacity|capacidade/i, "Onibus sem vagas disponiveis."],
    [/onibus.*inativo|bus.*inactive/i, "Onibus inativo nao pode ser selecionado."],
    [/CPF.*invalido|invalid.*cpf/i, "CPF invalido. Confira os numeros informados."],
    [/endereco|address/i, "Endereco incompleto ou invalido."],
    [/duplicad|unique|ja cadastrado/i, "Registro duplicado ou ja cadastrado."],
    [/permiss|forbidden|unauthorized|401|403/i, "Voce nao tem permissao para realizar esta acao."],
    [/incert|UNKNOWN|confirmar/i, "Situacao incerta. Consulte o registro antes de tentar novamente."],
    [/Prisma|Foreign key|constraint|SQL|stack/i, "Nao foi possivel concluir por uma restricao de dados. Revise os vinculos do registro."],
  ];

  for (const [pattern, replacement] of mappings) {
    if (pattern.test(text)) {
      return replacement;
    }
  }

  const requestId =
    text.match(/request(?:Id| ID| id)?[:=\s]+([A-Za-z0-9._-]+)/i)?.[1] ?? "";
  return requestId
    ? `Nao foi possivel concluir a operacao. Informe o codigo ${requestId} ao suporte.`
    : "Nao foi possivel concluir a operacao. Revise os dados e tente novamente.";
}
