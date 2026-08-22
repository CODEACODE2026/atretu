import assert from "node:assert/strict";
import { RecordStatus, RoleCode, UserStatus } from "@prisma/client";
import { BaseRecordsService } from "../base-records/base-records.service.js";
import { BusAssignmentsService } from "../bus-assignments/bus-assignments.service.js";
import { DocumentsService } from "../documents/documents.service.js";
import { OfficialDocumentsService } from "../official-documents/official-documents.service.js";
import { StudentCardsService } from "../student-cards/student-cards.service.js";
import type { AuthUser } from "../users/users.service.js";
import { SortOrder } from "./dto/students.dto.js";
import { StudentsService } from "./students.service.js";

const administrator: AuthUser = {
  email: "administrator@example.com",
  id: "administrator-1",
  institutionIds: [],
  name: "Administrator",
  permissionProfileId: null,
  roles: [RoleCode.ADMINISTRATOR],
  status: UserStatus.ACTIVE,
};

const secretaria: AuthUser = {
  email: "secretaria@example.com",
  id: "secretaria-1",
  institutionId: "institution-1",
  institutionIds: ["institution-1"],
  name: "Secretaria",
  permissionProfileId: null,
  roles: [RoleCode.SECRETARIA],
  status: UserStatus.ACTIVE,
};

function assertUnrestrictedStudentLookup(where: unknown) {
  assert.deepEqual(where, { id: "student-1" });
}

function assertRestrictedStudentLookup(where: unknown) {
  assert.deepEqual(where, {
    id: "student-1",
    enrollments: { some: { institutionId: "institution-1" } },
  });
}

async function testAdministratorReachesStudentOperationalProfileTabs() {
  const prisma = profilePrisma();

  await new DocumentsService(
    prisma as never,
    { values: { documentMaxSizeBytes: 1024 } } as never,
    {} as never,
    {} as never,
  ).listStudentDocuments("student-1", "all", administrator);

  await new OfficialDocumentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  ).listStudentModelIssues("student-1", administrator);

  await new StudentCardsService(
    prisma as never,
    {} as never,
    {} as never,
  ).listStudentCardsForStudent("student-1", administrator);

  await new StudentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  ).listStudentHistory("student-1", administrator);

  await new StudentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  ).listStudentLegacyFinancialHistory(
    "student-1",
    { page: 1, limit: 10, order: SortOrder.DESC },
    administrator,
  );

  assert.equal(prisma.studentFindFirstWhere.length, 5);
  for (const where of prisma.studentFindFirstWhere) {
    assertUnrestrictedStudentLookup(where);
  }
}

async function testSecretariaRemainsInstitutionScopedOnProfileTabs() {
  const prisma = profilePrisma();

  await new DocumentsService(
    prisma as never,
    { values: { documentMaxSizeBytes: 1024 } } as never,
    {} as never,
    {} as never,
  ).listStudentDocuments("student-1", "all", secretaria);

  await new StudentCardsService(
    prisma as never,
    {} as never,
    {} as never,
  ).listStudentCardsForStudent("student-1", secretaria);

  await new StudentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  ).listStudentHistory("student-1", secretaria);

  assert.equal(prisma.studentFindFirstWhere.length, 3);
  for (const where of prisma.studentFindFirstWhere) {
    assertRestrictedStudentLookup(where);
  }
  assert.deepEqual(prisma.studentCardFindManyWhere.at(-1), {
    studentId: "student-1",
    enrollment: { institutionId: "institution-1" },
  });
}

async function testAdministratorReachesStudentTransportProfileTab() {
  const prisma = transportPrisma();
  const service = new BusAssignmentsService(prisma as never);

  const assignment = await service.getCurrentAssignment(
    "enrollment-1",
    administrator,
  );
  const events = await service.listEnrollmentEvents("enrollment-1", administrator);

  assert.equal(assignment, null);
  assert.deepEqual(events, { data: [] });
  assert.equal(prisma.enrollmentFindUniqueCalls.length, 2);
}

async function testAdministratorSeesTransportBusesWithoutInstitutionProfile() {
  const prisma = busesPrisma();
  const service = new BaseRecordsService(prisma as never, {} as never);

  const response = await service.listBuses(
    { page: 1, limit: 10 } as never,
    administrator,
  );

  assert.equal(response.data.length, 1);
  assert.doesNotMatch(
    JSON.stringify(prisma.busAssignmentGroupByWhere.at(-1)),
    /institutionId/,
  );
}

async function testSecretariaRemainsScopedOnTransportProfileTab() {
  const service = new BusAssignmentsService(transportPrisma() as never);
  const buses = busesPrisma();

  await assert.rejects(
    () => service.getCurrentAssignment("enrollment-2", secretaria),
    /Acesso negado/,
  );

  await new BaseRecordsService(buses as never, {} as never).listBuses(
    { page: 1, limit: 10 } as never,
    secretaria,
  );
  assert.match(
    JSON.stringify(buses.busAssignmentGroupByWhere.at(-1)),
    /institution-1/,
  );
}

function profilePrisma() {
  const studentFindFirstWhere: unknown[] = [];
  const studentCardFindManyWhere: unknown[] = [];
  return {
    studentFindFirstWhere,
    studentCardFindManyWhere,
    student: {
      findFirst: async (args: { where: unknown }) => {
        studentFindFirstWhere.push(args.where);
        return { id: "student-1", personId: "person-1" };
      },
    },
    studentDocument: {
      findMany: async () => [],
    },
    officialDocumentIssue: {
      findMany: async () => [],
    },
    studentCard: {
      findMany: async (args: { where: unknown }) => {
        studentCardFindManyWhere.push(args.where);
        return [];
      },
    },
    studentHistoryEvent: {
      findMany: async () => [],
    },
    legacyFinancialImport: {
      aggregate: async () => ({
        _count: { _all: 0 },
        _sum: { nominalAmountCents: null, paidAmountCents: null },
      }),
      count: async () => 0,
      findMany: async (args: { take?: number }) =>
        args.take === undefined ? [] : [],
      groupBy: async () => [],
    },
  };
}

function transportPrisma() {
  const enrollmentFindUniqueCalls: unknown[] = [];
  return {
    enrollmentFindUniqueCalls,
    enrollment: {
      findUnique: async (args: { where: { id: string } }) => {
        enrollmentFindUniqueCalls.push(args);
        return {
          academicYearId: "academic-year-1",
          id: args.where.id,
          institutionId:
            args.where.id === "enrollment-2" ? "institution-2" : "institution-1",
          student: { person: { cpf: "12345678909", fullName: "Academico" } },
        };
      },
    },
    busAssignment: {
      findFirst: async () => null,
    },
    busAssignmentEvent: {
      findMany: async () => [],
    },
  };
}

function busesPrisma() {
  const busAssignmentGroupByWhere: unknown[] = [];
  return {
    busAssignmentGroupByWhere,
    academicYear: {
      findFirst: async () => ({ id: "academic-year-1" }),
    },
    bus: {
      count: async () => 1,
      findMany: async () => [
        {
          capacity: 40,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          id: "bus-1",
          name: "Onibus 1",
          normalizedName: "onibus 1",
          status: RecordStatus.ACTIVE,
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    },
    busAssignment: {
      groupBy: async (args: { where: unknown }) => {
        busAssignmentGroupByWhere.push(args.where);
        return [];
      },
    },
  };
}

await testAdministratorReachesStudentOperationalProfileTabs();
await testSecretariaRemainsInstitutionScopedOnProfileTabs();
await testAdministratorReachesStudentTransportProfileTab();
await testAdministratorSeesTransportBusesWithoutInstitutionProfile();
await testSecretariaRemainsScopedOnTransportProfileTab();

console.log("profile-tabs-operational-scope.spec.ts ok");
