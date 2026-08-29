import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RoleCode, UserStatus } from "@prisma/client";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
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
assert.match(controller, /mark-paid/);
assert.match(controller, /attachments\/:attachmentId\/download/);
assert.match(controller, /attachments\/:attachmentId\/view/);

assert.match(dto, /ManualFinancialMovementCategory/);
assert.match(dto, /class ListManualMovementStudentOptionsDto/);
assert.match(dto, /competenceDate/);
assert.match(dto, /@Max\(MAX_INVOICE_AMOUNT_CENTS\)/);
assert.match(dto, /page = 1/);
assert.match(dto, /limit = 20/);

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
assert.match(serviceSource, /getInstitutionScope\(user, OPERATIONAL_INSTITUTION_SCOPE\)/);
assert.match(serviceSource, /institutionId:\s*\{[\s\S]*in: scope\.type === "restricted" \? scope\.institutionIds : \[\]/);
assert.match(serviceSource, /assertUserManageMovementScope/);
assert.match(serviceSource, /assertStudentInstitutionScope/);
assert.match(serviceSource, /listStudentOptions/);
assert.match(serviceSource, /buildStudentOptionsWhere/);
assert.doesNotMatch(serviceSource, /students\.view/);
assert.match(serviceSource, /RoleCode\.USER/);
assert.match(serviceSource, /throw new ForbiddenException\("Acesso negado"\)/);
assert.match(serviceSource, /throw new ForbiddenException\("Acesso negado"\)/);
assert.doesNotMatch(serviceSource, /Sicredi|syncByInvoice|issueForInvoice|BankSlipsService/);

let listWhere: unknown;
const scopedService = new ManualFinancialMovementsService(
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

await scopedService.list({ limit: 20, page: 1 }, {
  email: "user@example.com",
  id: "user-a",
  institutionId: "institution-a",
  institutionIds: ["institution-a"],
  name: "User A",
  permissionProfileId: "profile-1",
  roles: [RoleCode.USER],
  status: UserStatus.ACTIVE,
});
assert.deepEqual(listWhere, {
  AND: [
    {},
    {
      institutionId: {
        in: ["institution-a"],
      },
    },
  ],
});

const movementA = movementRecord(["institution-a"]);
const detailService = new ManualFinancialMovementsService(
  {
    manualFinancialMovement: {
      findUnique: async () => movementA,
    },
  } as never,
  {} as never,
  {} as never,
);
await detailService.get("movement-a", {
  email: "user@example.com",
  id: "user-a",
  institutionId: "institution-a",
  institutionIds: ["institution-a"],
  name: "User A",
  permissionProfileId: "profile-1",
  roles: [RoleCode.USER],
  status: UserStatus.ACTIVE,
});
await assert.rejects(
  () =>
    detailService.get("movement-a", {
      email: "user@example.com",
      id: "user-b",
      institutionId: "institution-b",
      institutionIds: ["institution-b"],
      name: "User B",
      permissionProfileId: "profile-2",
      roles: [RoleCode.USER],
      status: UserStatus.ACTIVE,
    }),
  (error) => error instanceof ForbiddenException,
);

const legacyMovement = { ...movementRecord([]), student: null, studentId: null };
const legacyDetailService = new ManualFinancialMovementsService(
  {
    manualFinancialMovement: {
      findUnique: async () => legacyMovement,
    },
  } as never,
  {} as never,
  {} as never,
);
await assert.rejects(
  () =>
    legacyDetailService.get("movement-legacy", {
      email: "user@example.com",
      id: "user-a",
      institutionId: "institution-a",
      institutionIds: ["institution-a"],
      name: "User A",
      permissionProfileId: "profile-1",
      roles: [RoleCode.USER],
      status: UserStatus.ACTIVE,
    }),
  (error) => error instanceof ForbiddenException,
);
await legacyDetailService.get("movement-legacy", {
  email: "admin@example.com",
  id: "admin",
  institutionId: null,
  institutionIds: [],
  name: "Admin",
  roles: [RoleCode.ADMINISTRATOR],
  status: UserStatus.ACTIVE,
});

const userA = {
  email: "user@example.com",
  id: "user-a",
  institutionId: "institution-a",
  institutionIds: ["institution-a"],
  name: "User A",
  permissionProfileId: "profile-1",
  roles: [RoleCode.USER],
  status: UserStatus.ACTIVE,
};

await assert.rejects(
  () =>
    new ManualFinancialMovementsService({} as never, {} as never, {} as never).create(
      {
        amountCents: 1000,
        category: "OTHER",
        description: "Entrada global bloqueada",
        transactionDate: "2026-08-01",
        type: "INCOME",
      } as never,
      undefined,
      userA,
    ),
  (error) => error instanceof BadRequestException,
);

const expenseCreate = createHarness();
await expenseCreate.service.create(
  {
    amountCents: 1250,
    category: "FUEL",
    description: "Combustivel",
    institutionId: "institution-a",
    supplierName: "Posto A",
    transactionDate: "2026-08-01",
    type: "EXPENSE",
  } as never,
  undefined,
  userA,
);
assert.equal(expenseCreate.createdData?.institutionId, "institution-a");
assert.equal(expenseCreate.createdData?.studentId, null);
assert.equal(expenseCreate.studentHistoryEvents, 0);

const incomeCreate = createHarness();
await incomeCreate.service.create(
  {
    amountCents: 2500,
    category: "OTHER",
    description: "Entrada sem aluno",
    institutionId: "institution-a",
    transactionDate: "2026-08-01",
    type: "INCOME",
  } as never,
  undefined,
  userA,
);
assert.equal(incomeCreate.createdData?.institutionId, "institution-a");
assert.equal(incomeCreate.createdData?.studentId, null);
assert.equal(incomeCreate.studentHistoryEvents, 0);

const incomeStudentCreate = createHarness({ studentInstitutionId: "institution-a" });
await incomeStudentCreate.service.create(
  {
    amountCents: 2500,
    category: "OTHER",
    description: "Entrada com aluno",
    institutionId: "institution-a",
    studentId: "student-a",
    transactionDate: "2026-08-01",
    type: "INCOME",
  } as never,
  undefined,
  userA,
);
assert.equal(incomeStudentCreate.createdData?.institutionId, "institution-a");
assert.equal(incomeStudentCreate.createdData?.studentId, "student-a");
assert.equal(incomeStudentCreate.studentHistoryEvents, 1);

await assert.rejects(
  () =>
    createHarness().service.create(
      {
        amountCents: 1000,
        category: "OTHER",
        description: "Entrada fora de escopo",
        institutionId: "institution-b",
        transactionDate: "2026-08-01",
        type: "INCOME",
      } as never,
      undefined,
      userA,
    ),
  (error) => error instanceof ForbiddenException,
);

await assert.rejects(
  () =>
    createHarness({ studentInstitutionId: "institution-b" }).service.create(
      {
        amountCents: 1000,
        category: "OTHER",
        description: "Entrada aluno fora",
        institutionId: "institution-a",
        studentId: "student-b",
        transactionDate: "2026-08-01",
        type: "INCOME",
      } as never,
      undefined,
      userA,
    ),
  (error) => error instanceof ForbiddenException,
);

const userAB = { ...userA, institutionId: "institution-a", institutionIds: ["institution-a", "institution-b"] };
const multiCreate = createHarness();
await multiCreate.service.create(
  {
    amountCents: 1000,
    category: "OTHER",
    description: "Entrada B permitida",
    institutionId: "institution-b",
    transactionDate: "2026-08-01",
    type: "INCOME",
  } as never,
  undefined,
  userAB,
);
assert.equal(multiCreate.createdData?.institutionId, "institution-b");
await assert.rejects(
  () =>
    createHarness().service.create(
      {
        amountCents: 1000,
        category: "OTHER",
        description: "Entrada C negada",
        institutionId: "institution-c",
        transactionDate: "2026-08-01",
        type: "INCOME",
      } as never,
      undefined,
      userAB,
    ),
  (error) => error instanceof ForbiddenException,
);

const scopedMutationService = new ManualFinancialMovementsService(
  {
    manualFinancialMovement: {
      findUnique: async () => movementRecord(["institution-a"]),
    },
    institution: {
      findUnique: async () => ({ id: "institution-a", status: "ACTIVE" }),
    },
    student: {
      findUnique: async () => ({ id: "student-b" }),
      findFirst: async () => null,
    },
  } as never,
  {} as never,
  {} as never,
);

await assert.rejects(
  () =>
    scopedMutationService.update(
      "movement-a",
      { studentId: "student-b" } as never,
      userA,
    ),
  (error) => error instanceof ForbiddenException,
);

const movementBMutationService = new ManualFinancialMovementsService(
  {
    manualFinancialMovement: {
      findUnique: async () => ({
        ...movementRecord(["institution-b"]),
        status: "PENDING",
        supplierName: "Fornecedor B",
        type: "EXPENSE",
      }),
    },
  } as never,
  {} as never,
  {} as never,
);

await assert.rejects(
  () => movementBMutationService.markPaid("movement-b", {}, userA),
  (error) => error instanceof ForbiddenException,
);

const attachmentScopeService = new ManualFinancialMovementsService(
  {
    manualFinancialMovementAttachment: {
      findFirst: async () => ({
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        extension: "pdf",
        id: "attachment-b",
        mimeType: "application/pdf",
        movement: movementRecord(["institution-b"]),
        movementId: "movement-b",
        originalFileName: "comprovante.pdf",
        replacedAt: null,
        replacedById: null,
        sizeBytes: 10,
        status: "ACTIVE",
        storageKey: "finance/manual-movements/movement-b/attachment-b/comprovante.pdf",
        storedFileName: "comprovante.pdf",
        checksumSha256: "abc",
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        uploadedBy: { id: "user-b", name: "User B" },
        uploadedByUserId: "user-b",
      }),
    },
  } as never,
  { read: async () => Buffer.from("pdf") } as never,
  {} as never,
);
await assert.rejects(
  () => attachmentScopeService.readAttachment("movement-b", "attachment-b", "inline", userA),
  (error) => error instanceof ForbiddenException,
);

let studentOptionsWhere: unknown;
const scopedLookupService = new ManualFinancialMovementsService(
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

const studentOptions = await scopedLookupService.listStudentOptions(
  { limit: 10, page: 1, search: "Academico" },
  userA,
);
assert.deepEqual(studentOptionsWhere, {
  AND: [
    {
      enrollments: {
        some: {
          institutionId: { in: ["institution-a"] },
        },
      },
    },
    {
      OR: [
        { person: { normalizedName: { contains: "academico" } } },
        { studentCards: { some: { cardNumber: { contains: "Academico" } } } },
      ],
    },
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

let deniedLookupWhere: unknown;
const deniedLookupService = new ManualFinancialMovementsService(
  {
    student: {
      count: async ({ where }: { where: unknown }) => {
        deniedLookupWhere = where;
        return 0;
      },
      findMany: async ({ where }: { where: unknown }) => {
        deniedLookupWhere = where;
        return [];
      },
    },
  } as never,
  {} as never,
  {} as never,
);
const emptyStudentOptions = await deniedLookupService.listStudentOptions(
  { limit: 10, page: 1 },
  {
    ...userA,
    institutionId: null,
    institutionIds: [],
  },
);
assert.deepEqual(deniedLookupWhere, {
  enrollments: {
    some: {
      institutionId: { in: [] },
    },
  },
});
assert.deepEqual(emptyStudentOptions.data, []);

console.log("Manual financial movements backend guard OK");

function movementRecord(institutionIds: string[]) {
  const institutionId = institutionIds[0] ?? null;
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
    institution: institutionId
      ? { id: institutionId, name: `Instituicao ${institutionId}`, status: "ACTIVE" }
      : null,
    institutionId,
    notes: null,
    paidAt: null,
    status: "RECEIVED",
    student: {
      enrollments: institutionIds.map((institutionId) => ({
        institution: { id: institutionId, name: `Instituicao ${institutionId}` },
        institutionId,
      })),
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

function createHarness(options: { studentInstitutionId?: string } = {}) {
  let createdData: Record<string, unknown> | null = null;
  let studentHistoryEvents = 0;
  const prisma = {
    institution: {
      findUnique: async () => ({ id: "institution-a", status: "ACTIVE" }),
    },
    student: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
      findFirst: async ({ where }: { where: { id: string; enrollments: { some: { institutionId: string } } } }) =>
        options.studentInstitutionId === where.enrollments.some.institutionId
          ? { id: where.id }
          : null,
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

function movementRecordFromData(data: Record<string, unknown>) {
  const institutionId = String(data.institutionId ?? "institution-a");
  const studentId = typeof data.studentId === "string" ? data.studentId : null;
  return {
    ...movementRecord(studentId ? [institutionId] : []),
    amountCents: Number(data.amountCents ?? 1000),
    category: String(data.category ?? "OTHER"),
    description: String(data.description ?? "Movimento de teste"),
    institution: { id: institutionId, name: `Instituicao ${institutionId}`, status: "ACTIVE" },
    institutionId,
    status: String(data.status ?? "RECEIVED"),
    student: studentId ? movementRecord([institutionId]).student : null,
    studentId,
    supplierName: typeof data.supplierName === "string" ? data.supplierName : null,
    transactionDate: data.transactionDate as Date,
    type: String(data.type ?? "INCOME"),
  };
}
