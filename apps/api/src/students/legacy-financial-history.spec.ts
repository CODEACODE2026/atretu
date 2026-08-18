import assert from "node:assert/strict";
import { LegacyFinancialStatus } from "@prisma/client";
import { StudentsService } from "./students.service.js";
import { SortOrder } from "./dto/students.dto.js";

const calls: Array<{ method: string; args: Record<string, unknown> }> = [];

const records = Array.from({ length: 11 }, (_, index) => ({
  id: `legacy-financial-${index + 1}`,
  legacyFinancialId: 1000 + index,
  legacyStudentId: 863,
  status:
    index % 4 === 0
      ? LegacyFinancialStatus.PAGO
      : index % 4 === 1
        ? LegacyFinancialStatus.BAIXADO
        : index % 4 === 2
          ? LegacyFinancialStatus.PENDENTE
          : LegacyFinancialStatus.VENCIDO,
  situacaoBoleto: index % 4,
  nominalAmountCents: 10000 + index,
  paidAmountCents: index % 2 === 0 ? 10000 + index : null,
  fineAmountCents: index,
  interestAmountCents: index * 2,
  issuedAt: new Date(Date.UTC(2026, 0, 1)),
  dueDate: new Date(Date.UTC(index < 10 ? 2026 : 2025, index % 12, 20)),
  paidAt: index % 2 === 0 ? new Date(Date.UTC(2026, index % 12, 8)) : null,
  nossoNumero: `60000100${index}`,
  linhaDigitavel: "74891160090010050728407827151007997220000030000",
  codigoBarras: "74899972200000300001160000100507280782715100",
  boletoPath: "/legado/boleto.pdf",
  mailStatus: null,
  sentAt: null,
  source: "LEGACY",
  importedAt: new Date(Date.UTC(2026, 7, index + 1)),
}));

const prisma = {
  student: {
    findFirst: async (args: Record<string, unknown>) => {
      calls.push({ method: "student.findFirst", args });
      return { id: "student-1" };
    },
  },
  legacyFinancialImport: {
    findMany: async (args: Record<string, unknown>) => {
      calls.push({ method: "legacyFinancialImport.findMany", args });
      if ("take" in args) {
        return records.slice(0, Number(args.take));
      }
      return records.map((record) => ({ dueDate: record.dueDate }));
    },
    count: async (args: Record<string, unknown>) => {
      calls.push({ method: "legacyFinancialImport.count", args });
      return 11;
    },
    aggregate: async (args: Record<string, unknown>) => {
      calls.push({ method: "legacyFinancialImport.aggregate", args });
      return {
        _count: { _all: 11 },
        _sum: {
          nominalAmountCents: 110066,
          paidAmountCents: 60030,
        },
      };
    },
    groupBy: async (args: Record<string, unknown>) => {
      calls.push({ method: "legacyFinancialImport.groupBy", args });
      return [
        { status: LegacyFinancialStatus.PAGO, _count: { status: 3 } },
        { status: LegacyFinancialStatus.BAIXADO, _count: { status: 3 } },
        { status: LegacyFinancialStatus.PENDENTE, _count: { status: 3 } },
        { status: LegacyFinancialStatus.VENCIDO, _count: { status: 2 } },
      ];
    },
  },
};

const service = new StudentsService(prisma as never, {} as never, {} as never, {} as never);

const response = await service.listStudentLegacyFinancialHistory(
  "student-1",
  {
    page: 1,
    limit: 10,
    status: LegacyFinancialStatus.PAGO,
    year: 2026,
    order: SortOrder.DESC,
  },
  { id: "user-1", roles: ["SUPER_ADMIN"], institutionIds: [] } as never,
);

assert.equal(response.data.length, 10);
assert.equal(response.pagination.page, 1);
assert.equal(response.pagination.limit, 10);
assert.equal(response.pagination.total, 11);
assert.equal(response.pagination.totalPages, 2);
assert.equal(response.summary.totalRecords, 11);
assert.equal(response.summary.byStatus.PAGO, 3);
assert.equal(response.summary.byStatus.BAIXADO, 3);
assert.equal(response.summary.byStatus.PENDENTE, 3);
assert.equal(response.summary.byStatus.VENCIDO, 2);
assert.equal(response.summary.nominalAmountCents, 110066);
assert.equal(response.summary.paidAmountCents, 60030);
assert.deepEqual(response.summary.years, [2026, 2025]);

const pagedFind = calls.find(
  (call) => call.method === "legacyFinancialImport.findMany" && "take" in call.args,
);
assert.equal(pagedFind?.args.take, 10);
assert.equal(pagedFind?.args.skip, 0);
assert.deepEqual(pagedFind?.args.orderBy, [
  { dueDate: "desc" },
  { importedAt: "desc" },
]);
assert.deepEqual(pagedFind?.args.where, {
  studentId: "student-1",
  source: "LEGACY",
  status: LegacyFinancialStatus.PAGO,
  dueDate: {
    gte: new Date(Date.UTC(2026, 0, 1)),
    lt: new Date(Date.UTC(2027, 0, 1)),
  },
});
