import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RoleCode, UserStatus } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { ManualFinancialMovementsService } from "./manual-movements.service.js";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./manual-movements.service.ts", import.meta.url), "utf8");
const controller = readFileSync(new URL("./manual-movements.controller.ts", import.meta.url), "utf8");
const studentsController = readFileSync(new URL("../students/students.controller.ts", import.meta.url), "utf8");
const dto = readFileSync(new URL("./dto/manual-movements.dto.ts", import.meta.url), "utf8");

assert.match(schema, /model ManualFinancialMovement \{/);
assert.match(schema, /type\s+ManualFinancialMovementType/);
assert.match(schema, /status\s+ManualFinancialMovementStatus/);
assert.match(schema, /amountCents\s+Int\s+@map\("amount_cents"\)/);
assert.match(schema, /transactionDate\s+DateTime\s+@map\("transaction_date"\) @db\.Date/);
assert.match(schema, /competenceDate\s+DateTime\?\s+@map\("competence_date"\) @db\.Date/);
assert.doesNotMatch(schema, /competence\s+String.*manual/i);
assert.match(schema, /model ManualFinancialMovementAttachment \{/);
assert.match(schema, /storageKey\s+String\s+@unique/);
assert.match(schema, /manualFinancialMovementId\s+String\?/);
assert.match(schema, /MANUAL_FINANCIAL_INCOME_RECORDED/);
assert.doesNotMatch(manualMovementModel(schema), /institutionId|institution\s+Institution/);
assert.doesNotMatch(institutionModel(schema), /manualFinancialMovements/);

assert.match(controller, /@Controller\("finance\/manual-movements"\)/);
assert.match(controller, /@OperationalPermission\("manualMovements\.view"\)[\s\S]*list/);
assert.match(controller, /@Get\("student-options"\)[\s\S]*@OperationalPermission\("manualMovements\.manage"\)[\s\S]*listStudentOptions/);
assert.match(controller, /@OperationalPermission\("manualMovements\.view"\)[\s\S]*get/);
assert.match(controller, /@OperationalPermission\("manualMovements\.manage"\)[\s\S]*create/);
assert.match(controller, /@OperationalPermission\("manualMovements\.manage"\)[\s\S]*update/);
assert.match(controller, /@OperationalPermission\("manualMovements\.manage"\)[\s\S]*markPaid/);
assert.match(controller, /@OperationalPermission\("manualMovements\.manage"\)[\s\S]*cancel/);
assert.match(controller, /@OperationalPermission\("manualMovements\.manage"\)[\s\S]*attach/);
assert.match(controller, /@OperationalPermission\("manualMovements\.manage"\)[\s\S]*viewAttachment/);
assert.match(controller, /@OperationalPermission\("manualMovements\.manage"\)[\s\S]*downloadAttachment/);
assert.doesNotMatch(controller, /RolesGuard|OPERATIONAL_ADMIN_ROLES/);
assert.match(studentsController, /@Get\("students"\)[\s\S]*@OperationalPermission\("students\.view", "reports\.view"\)[\s\S]*listStudents/);
assert.match(studentsController, /@Get\("students\/:id"\)[\s\S]*@OperationalPermission\("students\.view"\)[\s\S]*getStudent/);
assert.match(controller, /manualFinancialMovementUploadOptions/);
assert.match(controller, /attachmentUploadInterceptor[\s\S]*singleDocumentUploadOptions/);

assert.match(dto, /ManualFinancialMovementCategory/);
assert.match(dto, /class ListManualMovementStudentOptionsDto/);
assert.match(dto, /competenceDate/);
assert.match(dto, /@Max\(MAX_INVOICE_AMOUNT_CENTS\)/);
assert.match(dto, /page = 1/);
assert.match(dto, /limit = 20/);
assert.doesNotMatch(dto, /institutionId/);

assert.match(serviceSource, /ManualFinancialMovementType\.INCOME[\s\S]*ManualFinancialMovementStatus\.RECEIVED/);
assert.match(serviceSource, /ManualFinancialMovementType\.EXPENSE[\s\S]*ManualFinancialMovementStatus\.PENDING/);
assert.match(serviceSource, /StudentHistoryEventType\.MANUAL_FINANCIAL_INCOME_RECORDED/);
assert.match(serviceSource, /formatInvoiceAmount\(movement\.amountCents\)/);
assert.match(serviceSource, /function normalizeAmount\(amountCents: number \| string\)/);
assert.match(serviceSource, /typeof amountCents === "string"[\s\S]*Number\(amountCents\)/);
assert.match(serviceSource, /DocumentStorageService/);
assert.match(serviceSource, /image\/webp/);
assert.match(serviceSource, /WEBP/);
assert.match(serviceSource, /Assinatura do arquivo invalida/);
assert.match(serviceSource, /storage\.write/);
assert.doesNotMatch(serviceSource, /base64/i);
assert.match(serviceSource, /MANUAL_FINANCIAL_MOVEMENT_ATTACHMENT_UPLOADED/);
assert.match(serviceSource, /REPLACED/);
assert.match(serviceSource, /resolvePagination/);
assert.match(serviceSource, /incomeReceivedCents[\s\S]*expensePaidCents[\s\S]*netCents/);
assert.match(serviceSource, /listStudentOptions/);
assert.match(serviceSource, /buildStudentOptionsWhere/);
assert.doesNotMatch(serviceSource, /students\.view/);
assert.doesNotMatch(serviceSource, /getInstitutionScope|OPERATIONAL_INSTITUTION_SCOPE|UserInstitution|assert.*Institution|applyInstitutionScope|institutionScopeFilter/);
assert.doesNotMatch(serviceSource, /Sicredi|syncByInvoice|issueForInvoice|BankSlipsService/);

let listWhere: unknown;
const listService = new ManualFinancialMovementsService(
  {
    manualFinancialMovement: {
      count: async ({ where }: { where: unknown }) => {
        listWhere = where;
        return 0;
      },
      findMany: async ({ where }: { where: unknown }) => {
        listWhere = where;
        return [];
      },
      groupBy: async ({ where }: { where: unknown }) => {
        listWhere = where;
        return [];
      },
    },
  } as never,
  {} as never,
  {} as never,
);

await listService.list({ limit: 20, page: 1 }, scopedUser());
assert.deepEqual(listWhere, {});

const detailService = new ManualFinancialMovementsService(
  {
    manualFinancialMovement: {
      findUnique: async () => movementRecord(),
    },
  } as never,
  {} as never,
  {} as never,
);
await detailService.get("movement-a", scopedUser());
await detailService.get("movement-a", {
  ...scopedUser(),
  id: "user-b",
  institutionId: "institution-b",
  institutionIds: ["institution-b"],
});

const userA = scopedUser();
const expenseCreate = createHarness();
await expenseCreate.service.create(
  {
    amountCents: 1250,
    category: "FUEL",
    description: "Combustivel",
    supplierName: "Posto A",
    transactionDate: "2026-08-01",
    type: "EXPENSE",
  } as never,
  undefined,
  userA,
);
assert.equal(expenseCreate.createdData?.studentId, null);
assert.equal(expenseCreate.studentHistoryEvents, 0);
assert.equal("institutionId" in (expenseCreate.createdData ?? {}), false);

const incomeCreate = createHarness();
await incomeCreate.service.create(
  {
    amountCents: 2500,
    category: "OTHER",
    description: "Entrada sem aluno",
    transactionDate: "2026-08-01",
    type: "INCOME",
  } as never,
  undefined,
  userA,
);
assert.equal(incomeCreate.createdData?.studentId, null);
assert.equal(incomeCreate.studentHistoryEvents, 0);

const incomeStudentCreate = createHarness();
await incomeStudentCreate.service.create(
  {
    amountCents: 2500,
    category: "OTHER",
    description: "Entrada com aluno",
    studentId: "student-a",
    transactionDate: "2026-08-01",
    type: "INCOME",
  } as never,
  undefined,
  userA,
);
assert.equal(incomeStudentCreate.createdData?.studentId, "student-a");
assert.equal(incomeStudentCreate.studentHistoryEvents, 1);

await assert.rejects(
  () =>
    createHarness({ studentExists: false }).service.create(
      {
        amountCents: 1000,
        category: "OTHER",
        description: "Entrada aluno inexistente",
        studentId: "student-missing",
        transactionDate: "2026-08-01",
        type: "INCOME",
      } as never,
      undefined,
      userA,
    ),
  (error) => error instanceof BadRequestException,
);

const mutationService = mutationHarness();
await mutationService.service.update(
  "movement-a",
  { studentId: "student-b" } as never,
  userA,
);
assert.equal(mutationService.updatedData?.studentId, "student-b");

const paidService = mutationHarness({
  movement: { ...movementRecord(), status: "PENDING", supplierName: "Fornecedor", type: "EXPENSE" },
});
await paidService.service.markPaid("movement-a", {}, userA);
assert.equal(paidService.updatedData?.status, "PAID");

const attachmentService = new ManualFinancialMovementsService(
  {
    manualFinancialMovementAttachment: {
      findFirst: async () => ({
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        extension: "pdf",
        id: "attachment-a",
        mimeType: "application/pdf",
        movement: movementRecord(),
        movementId: "movement-a",
        originalFileName: "comprovante.pdf",
        replacedAt: null,
        replacedById: null,
        sizeBytes: 10,
        status: "ACTIVE",
        storageKey: "finance/manual-movements/movement-a/attachment-a/comprovante.pdf",
        storedFileName: "comprovante.pdf",
        checksumSha256: "abc",
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        uploadedBy: { id: "user-a", name: "User A" },
        uploadedByUserId: "user-a",
      }),
    },
  } as never,
  { read: async () => Buffer.from("pdf") } as never,
  { record: async () => ({}) } as never,
);
const attachment = await attachmentService.readAttachment(
  "movement-a",
  "attachment-a",
  "inline",
  userA,
);
assert.equal(attachment.fileName, "comprovante.pdf");

let studentOptionsWhere: unknown;
const lookupService = new ManualFinancialMovementsService(
  {
    student: {
      count: async ({ where }: { where: unknown }) => {
        studentOptionsWhere = where;
        return 1;
      },
      findMany: async ({ where }: { where: unknown }) => {
        studentOptionsWhere = where;
        return [
          studentOptionRecord({
            id: "student-a",
            institutionId: "institution-a",
            name: "Academico A",
          }),
        ];
      },
    },
  } as never,
  {} as never,
  {} as never,
);

const studentOptions = await lookupService.listStudentOptions(
  { limit: 10, page: 1, search: "Academico" },
  userA,
);
assert.deepEqual(studentOptionsWhere, {
  OR: [
    { person: { normalizedName: { contains: "academico" } } },
    { studentCards: { some: { cardNumber: { contains: "Academico" } } } },
  ],
});
assert.deepEqual(studentOptions.data, [
  {
    studentId: "student-a",
    name: "Academico A",
    cpfMasked: "123.***.***-01",
    enrollmentId: "enrollment-student-a",
    institutionId: "institution-a",
    institutionName: "Instituicao institution-a",
    cardNumber: "2026-0001",
  },
]);

console.log("Manual financial movements global capability guard OK");

function movementRecord(overrides: Record<string, unknown> = {}) {
  return {
    activeAttachment: null,
    amountCents: 1000,
    attachments: [],
    cancelReason: null,
    cancelledAt: null,
    cancelledBy: null,
    category: "OTHER",
    competenceDate: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    createdBy: { id: "user-admin", name: "Admin" },
    description: "Movimento de teste",
    documentNumber: null,
    dueDate: null,
    id: "movement-a",
    notes: null,
    paidAt: null,
    status: "RECEIVED",
    student: {
      enrollments: [
        {
          institution: { id: "institution-a", name: "Instituicao institution-a" },
          institutionId: "institution-a",
        },
      ],
      id: "student-a",
      person: { cpf: "12345678901", fullName: "Academico A" },
      studentCards: [],
    },
    studentId: "student-a",
    supplierDocument: null,
    supplierName: null,
    transactionDate: new Date("2026-08-01T00:00:00.000Z"),
    type: "INCOME",
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedBy: null,
    ...overrides,
  };
}

function studentOptionRecord(input: {
  id: string;
  institutionId: string;
  name: string;
}) {
  return {
    enrollments: [
      {
        id: `enrollment-${input.id}`,
        institution: { id: input.institutionId, name: `Instituicao ${input.institutionId}` },
        institutionId: input.institutionId,
      },
    ],
    id: input.id,
    person: { cpf: "12345678901", fullName: input.name },
    studentCards: [{ cardNumber: "2026-0001" }],
  };
}

function createHarness(options: { studentExists?: boolean } = {}) {
  let createdData: Record<string, unknown> | null = null;
  let studentHistoryEvents = 0;
  const prisma = {
    student: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        options.studentExists === false ? null : { id: where.id },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        administrativeAuditLog: { create: async () => ({}) },
        manualFinancialMovement: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdData = data;
            return movementRecordFromData(data);
          },
          findUniqueOrThrow: async () => movementRecordFromData(createdData ?? {}),
        },
        studentHistoryEvent: {
          create: async () => {
            studentHistoryEvents += 1;
            return {};
          },
        },
      };
      return callback(tx);
    },
  };
  return {
    get createdData() {
      return createdData;
    },
    get studentHistoryEvents() {
      return studentHistoryEvents;
    },
    service: new ManualFinancialMovementsService(prisma as never, {} as never, {} as never),
  };
}

function mutationHarness(options: { movement?: Record<string, unknown> } = {}) {
  let updatedData: Record<string, unknown> | null = null;
  const current = options.movement ?? movementRecord();
  const prisma = {
    manualFinancialMovement: {
      findUnique: async () => current,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updatedData = data;
        return { ...current, ...data };
      },
    },
    student: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        administrativeAuditLog: { create: async () => ({}) },
        manualFinancialMovement: prisma.manualFinancialMovement,
      }),
  };
  return {
    get updatedData() {
      return updatedData;
    },
    service: new ManualFinancialMovementsService(prisma as never, {} as never, {} as never),
  };
}

function movementRecordFromData(data: Record<string, unknown>) {
  const studentId = typeof data.studentId === "string" ? data.studentId : null;
  return {
    ...movementRecord(),
    amountCents: Number(data.amountCents ?? 1000),
    category: String(data.category ?? "OTHER"),
    description: String(data.description ?? "Movimento de teste"),
    status: String(data.status ?? "RECEIVED"),
    student: studentId ? movementRecord().student : null,
    studentId,
    supplierName: typeof data.supplierName === "string" ? data.supplierName : null,
    transactionDate: data.transactionDate as Date,
    type: String(data.type ?? "INCOME"),
  };
}

function scopedUser() {
  return {
    email: "user@example.com",
    id: "user-a",
    institutionId: "institution-a",
    institutionIds: ["institution-a"],
    name: "User A",
    permissionProfileId: "profile-1",
    roles: [RoleCode.USER],
    status: UserStatus.ACTIVE,
  };
}

function manualMovementModel(source: string) {
  return source.match(/model ManualFinancialMovement \{[\s\S]*?\n\}/)?.[0] ?? "";
}

function institutionModel(source: string) {
  return source.match(/model Institution \{[\s\S]*?\n\}/)?.[0] ?? "";
}
