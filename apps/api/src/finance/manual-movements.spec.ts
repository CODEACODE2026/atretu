import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RoleCode, UserStatus } from "@prisma/client";
import { ForbiddenException } from "@nestjs/common";
import { ManualFinancialMovementsService } from "./manual-movements.service.js";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./manual-movements.service.ts", import.meta.url), "utf8");
const controller = readFileSync(new URL("./manual-movements.controller.ts", import.meta.url), "utf8");
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
assert.match(controller, /@OperationalPermission\("manualMovements\.view"\)[\s\S]*get/);
assert.match(controller, /@Roles\(\.\.\.OPERATIONAL_ADMIN_ROLES\)/);
assert.match(controller, /manualFinancialMovementUploadOptions/);
assert.match(controller, /attachmentUploadInterceptor[\s\S]*singleDocumentUploadOptions/);
assert.match(controller, /mark-paid/);
assert.match(controller, /attachments\/:attachmentId\/download/);
assert.match(controller, /attachments\/:attachmentId\/view/);

assert.match(dto, /ManualFinancialMovementCategory/);
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
assert.match(serviceSource, /student:\s*\{[\s\S]*enrollments:\s*\{[\s\S]*some:\s*\{[\s\S]*institutionId: \{ in: institutionIds \}/);
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
      student: {
        enrollments: {
          some: {
            institutionId: { in: ["institution-a"] },
          },
        },
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

console.log("Manual financial movements backend guard OK");

function movementRecord(institutionIds: string[]) {
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
