import assert from "node:assert/strict";
import { LegacyImportService } from "./legacy-import.service.js";

const academicYear = {
  id: "year-2026",
  year: 2026,
  isCurrent: true,
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const institution = {
  id: "inst-ifpr",
  name: "IFPR",
  normalizedName: "ifpr",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const shift = {
  id: "shift-noturno",
  name: "NOTURNO",
  normalizedName: "noturno",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const bus = {
  id: "bus-central",
  name: "Circular Central",
  normalizedName: "circular central",
  capacity: 46,
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prisma = {
  institution: { findMany: async () => [institution] },
  shift: { findMany: async () => [shift] },
  bus: { findMany: async () => [bus] },
  academicYear: { findMany: async () => [academicYear] },
  person: {
    findMany: async ({ where }: { where: { cpf: { in: string[] } } }) =>
      where.cpf.in.includes("98765432100")
        ? [{ cpf: "98765432100", student: { id: "student-existing" } }]
        : [],
  },
  legacyStudentImport: {
    findMany: async ({ where }: { where: { legacyId: { in: number[] } } }) =>
      where.legacyId.in.includes(900)
        ? [
            {
              id: "legacy-student-900",
              legacyId: 900,
              source: "LEGACY",
              legacyTable: "tab_academico",
              studentId: "student-900",
            },
          ]
        : [],
  },
  legacyFinancialImport: {
    findMany: async ({ where }: { where: { legacyFinancialId: { in: number[] } } }) =>
      where.legacyFinancialId.in.includes(999)
        ? [{ legacyFinancialId: 999 }]
        : [],
  },
  studentCard: {
    findMany: async ({ where }: { where: { cardNumber: { in: string[] } } }) =>
      where.cardNumber.in.includes("112024") ? [{ cardNumber: "112024" }] : [],
  },
};

const service = new LegacyImportService(prisma as never, {} as never);

function record(overrides: Record<string, unknown> = {}) {
  return {
    legacy_id: 863,
    numero_carterinha: 312026,
    nome_aluno: "ADRIELY   AIKO HOGAHA   MORAIS",
    endereco: "Rua Um, 123",
    cpf: "529.982.247-25",
    rg: "123",
    data_nacimento: "23/10/2006",
    nome_instituicao: "IFPR",
    curso: "Tecnico",
    serie: "1",
    nome_turno: "NOTURNO",
    telefone: "(44) 99999-8888",
    email: "ALUNA@EXAMPLE.COM",
    data_cadastro: "2024-03-18",
    status: 1,
    chapa: 0,
    nome_onibus: "Circular Central",
    capacidade_onibus: 46,
    observacao: null,
    criado: 2024,
    ...overrides,
  };
}

const preview = await service.analyzeAcademicImport({
  destinationAcademicYear: 2026,
  fileName: "piloto.json",
  mimeType: "application/json",
  sizeBytes: 1000,
  records: [
    record(),
    record({ legacy_id: 864, cpf: "52998224725" }),
    record({ legacy_id: 865, cpf: "987.654.321-00" }),
    record({ legacy_id: 866, cpf: "111.111.111-11" }),
    record({ legacy_id: 867, data_nacimento: "31/02/2006" }),
    record({
      legacy_id: 868,
      cpf: "111.222.333-96",
      nome_instituicao: "IFPR NOTURNO",
    }),
    record({ legacy_id: 869, cpf: "222.333.444-05", nome_turno: "VESPERTINO" }),
    record({ legacy_id: 870, cpf: "123.456.789-09", nome_onibus: "Linha Rural" }),
    record({
      legacy_id: 871,
      cpf: "987.654.320-29",
      nome_onibus: "",
      numero_carterinha: "112024",
    }),
    record({ legacy_id: 863, observacao: "Aluno pediu desligamento" }),
  ],
});

assert.equal(preview.items.length, 10);
assert.equal(preview.items[0]?.name, "ADRIELY AIKO HOGAHA MORAIS");
assert.equal(preview.items[0]?.legacyCreatedYear, 2024);
assert.equal(preview.items[0]?.destinationAcademicYear, 2026);
assert.equal(preview.items[0]?.relations.academicYear.legacyName, "2026");
assert.equal(preview.items[0]?.status, "BLOQUEADO");
assert.equal(preview.items[0]?.canImport, false);
assert(preview.items[0]?.reasons.includes("CPF duplicado dentro do JSON"));
assert(preview.items[2]?.reasons.includes("CPF ja existente no ATRETU"));
assert(preview.items[3]?.reasons.includes("CPF invalido"));
assert(preview.items[4]?.reasons.includes("Nascimento DD/MM/YYYY invalido"));
assert.equal(preview.items[5]?.status, "PENDENCIA");
assert.equal(preview.items[5]?.canImport, true);
assert.equal(preview.items[5]?.requiresBaseRecordCreation, true);
assert(preview.items[5]?.reasons.includes("Instituicao nao existe no ATRETU; sera criada ao importar"));
assert.equal(preview.items[6]?.status, "PENDENCIA");
assert.equal(preview.items[6]?.canImport, true);
assert.equal(preview.items[6]?.requiresBaseRecordCreation, true);
assert(preview.items[6]?.reasons.includes("Turno nao existe no ATRETU; sera criado ao importar"));
assert(preview.items[7]?.reasons.includes("Onibus nao existe no ATRETU; sera criado ao importar"));
assert.equal(preview.items[7]?.status, "PENDENCIA");
assert.equal(preview.items[7]?.canImport, true);
assert.equal(preview.items[7]?.requiresBaseRecordCreation, true);
assert.equal(preview.items[8]?.busLegacy, null);
assert(preview.items[8]?.reasons.includes("Numero de carteirinha legado conflita no ATRETU"));
assert.equal(preview.items[8]?.status, "PENDENCIA");
assert.equal(preview.items[8]?.canImport, true);
assert(preview.items[9]?.reasons.includes("legacy_id duplicado dentro do JSON"));
assert(preview.items[9]?.reasons.includes("Observacao sugere desligamento, mudanca ou inativacao"));

const readyPreview = await service.analyzeAcademicImport({
  destinationAcademicYear: 2026,
  fileName: "pronto.json",
  records: [record({ legacy_id: 880, cpf: "390.533.447-05" })],
});
assert.equal(readyPreview.items[0]?.status, "PRONTO");
assert.equal(readyPreview.items[0]?.canImport, true);
assert.equal(readyPreview.limits.maxRecordsPerBatch, 500);
assert.equal(readyPreview.limits.chunkSize, 25);

const fiftyRecords = Array.from({ length: 50 }, (_, index) =>
  record({
    legacy_id: 1000 + index,
    cpf: String(10000000000 + index),
  }),
);
const fiftyPreview = await service.analyzeAcademicImport({
  destinationAcademicYear: 2026,
  fileName: "cinquenta.json",
  records: fiftyRecords,
});
assert.equal(fiftyPreview.items.length, 50);

const oneHundredRecords = Array.from({ length: 100 }, (_, index) =>
  record({
    legacy_id: 2000 + index,
    cpf: String(20000000000 + index),
  }),
);
const oneHundredPreview = await service.analyzeAcademicImport({
  destinationAcademicYear: 2026,
  fileName: "cem.json",
  records: oneHundredRecords,
});
assert.equal(oneHundredPreview.items.length, 100);

const alreadyImportedPreview = await service.analyzeAcademicImport({
  destinationAcademicYear: 2026,
  fileName: "importado.json",
  records: [record({ legacy_id: 900, cpf: "390.533.447-05" })],
});
assert.equal(alreadyImportedPreview.items[0]?.status, "JA_IMPORTADO");
assert.equal(alreadyImportedPreview.items[0]?.canImport, false);
assert(
  alreadyImportedPreview.items[0]?.reasons.includes("Registro legado ja importado"),
);

const financialPreview = await service.analyzeFinancialImport({
  fileName: "financeiro.json",
  mimeType: "application/json",
  sizeBytes: 500,
  records: [
    {
      legacy_financial_id: 41,
      legacy_student_id: 900,
      data_emissao: "2024-05-09 10:29:00",
      data_vencimento: "2024-05-20 00:00:00",
      status_boleto: "BAIXADO",
      valor_boleto: 300,
      linha_digitavel: "74891160090010050728407827151007997220000030000",
      nosso_numero: "600001005",
      codigo_barras: "74899972200000300001160000100507280782715100",
      caminhao_boleto: "https://example.test/boleto.pdf",
      valor_multa: null,
      valor_juros: null,
      valor_pago: null,
      data_pagamento: null,
      situacao_boleto: 2,
      status_mail: 0,
      dt_envio_boleto: null,
    },
    {
      legacy_financial_id: 42,
      legacy_student_id: 901,
      data_emissao: "2024-06-09 10:29:00",
      data_vencimento: "2024-06-20 00:00:00",
      status_boleto: "PAGO",
      valor_boleto: 250.5,
      valor_multa: 1.25,
      valor_juros: 2.75,
      valor_pago: 254.5,
      data_pagamento: "2024-06-19 12:00:00",
      situacao_boleto: 0,
    },
    {
      legacy_financial_id: 999,
      legacy_student_id: 900,
      data_emissao: "2024-07-09 10:29:00",
      data_vencimento: "2024-07-20 00:00:00",
      status_boleto: "PENDENTE",
      valor_boleto: 275,
      situacao_boleto: 1,
    },
    {
      legacy_financial_id: 43,
      legacy_student_id: 900,
      data_emissao: "2024-08-09 10:29:00",
      data_vencimento: "2024-08-20 00:00:00",
      status_boleto: "VENCIDO",
      valor_boleto: 125,
      situacao_boleto: 3,
    },
  ],
});

assert.equal(financialPreview.summary.totalRecords, 4);
assert.equal(financialPreview.summary.totalLegacyStudents, 2);
assert.equal(financialPreview.summary.linkedLegacyStudents, 1);
assert.deepEqual(financialPreview.summary.unlinkedLegacyStudents, [901]);
assert.equal(financialPreview.summary.byStatus.BAIXADO, 1);
assert.equal(financialPreview.summary.byStatus.PAGO, 1);
assert.equal(financialPreview.summary.byStatus.PENDENTE, 1);
assert.equal(financialPreview.summary.byStatus.VENCIDO, 1);
assert.equal(financialPreview.summary.nominalAmountCents, 95050);
assert.equal(financialPreview.summary.paidAmountCents, 25450);
assert.equal(financialPreview.summary.fineAmountCents, 125);
assert.equal(financialPreview.summary.interestAmountCents, 275);
assert.equal(financialPreview.items[0]?.canImport, true);
assert.equal(financialPreview.items[1]?.status, "BLOQUEADO");
assert(
  financialPreview.items[1]?.reasons.includes(
    "legacy_student_id sem vinculo em LegacyStudentImport",
  ),
);
assert.equal(financialPreview.items[2]?.status, "JA_IMPORTADO");
assert.equal(financialPreview.items[3]?.statusBoleto, "VENCIDO");
assert.equal(financialPreview.items[3]?.canImport, true);

await assert.rejects(
  () =>
    service.importFinancialSelection(
      {
        fileName: "financeiro.json",
        records: financialPreview.items.map((item) => ({
          legacy_financial_id: item.legacyFinancialId ?? undefined,
          legacy_student_id: item.legacyStudentId ?? undefined,
          status_boleto: item.statusBoleto,
          situacao_boleto: item.situacaoBoleto,
          valor_boleto: item.nominalAmountCents ? item.nominalAmountCents / 100 : null,
        })),
        selectedLegacyStudentIds: [900],
      },
      { id: "user-admin" } as never,
    ),
  /historico somente leitura/,
);

await assert.rejects(
  () =>
    service.analyzeAcademicImport({
      destinationAcademicYear: 2026,
      fileName: "piloto.txt",
      records: [record()],
    }),
  /extensao .json/,
);

await assert.rejects(
  () =>
    service.importAcademicSelection(
      {
        records: [record({ legacy_id: 881, nome_instituicao: "IFPR NOTURNO" })],
        destinationAcademicYear: 2026,
        selectedLegacyIds: [881],
        confirmReviewRequired: true,
      },
      { id: "user-admin" } as never,
    ),
  /Criacao de cadastros-base ausentes exige confirmacao SUPER_ADMIN/,
);

let sequenceUpdate: unknown = null;
await (service as unknown as {
  reconcileCardSequenceAfterRollback: (
    tx: unknown,
    input: { academicYearId: string; previous: number; sequenceNumber: number },
  ) => Promise<void>;
}).reconcileCardSequenceAfterRollback(
  {
    $queryRaw: async () => [],
    cardSequence: {
      updateMany: async (input: unknown) => {
        sequenceUpdate = input;
      },
    },
  },
  { academicYearId: "year-2024", previous: 9, sequenceNumber: 10 },
);

assert.deepEqual(sequenceUpdate, {
  where: { academicYearId: "year-2024", lastSequenceNumber: 10 },
  data: { lastSequenceNumber: 9 },
});
