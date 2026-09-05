import "reflect-metadata";
import assert from "node:assert/strict";
import {
  AdministrativeAuditEventType,
  AcademicYearStatus,
  EnrollmentStatus,
  RecordStatus,
  RoleCode,
  UserStatus,
} from "@prisma/client";
import type { AuthUser } from "../users/users.service.js";
import {
  SortOrder,
  StudentBoardMembershipFilter,
  StudentSort,
  StudentStatusFilter,
} from "./dto/students.dto.js";
import { StudentsService } from "./students.service.js";

const targetAcademicYear = academicYear("year-2026", 2026);
const previousAcademicYear = academicYear("year-2025", 2025);
const destinationInstitution = record("institution-destination", "UTFPR");
const previousInstitution = record("institution-previous", "IFPR");
const shift = record("shift-night", "Noturno");
const bus = { ...record("bus-1", "Linha Norte"), capacity: 42 };
const reenrollmentAudit = {
  id: "audit-reenrollment",
  createdAt: new Date("2026-01-10T12:00:00.000Z"),
  domain: "enrollments",
  eventType: AdministrativeAuditEventType.ENROLLMENT_CREATED,
  metadata: {
    academicYearId: targetAcademicYear.id,
    enrollmentId: "enrollment-reenrolled",
    previousEnrollmentId: "enrollment-previous",
    reenrollment: true,
    studentId: "student-1",
  },
  recordId: "enrollment-reenrolled",
  user: {
    email: "operador@atretu.local",
    id: "user-operator",
    name: "Operador",
  },
  userId: "user-operator",
};

await testCompletedReenrollmentsUseAuditAsSourceOfTruth();
await testCompletedReenrollmentsExcludeRegularEnrollment();
await testCompletedReenrollmentsIgnoreAuditWithoutEnrollmentId();
await testCompletedReenrollmentsDeduplicateAuditEvents();
await testCompletedReenrollmentsAllowMissingPreviousEnrollmentAndUser();
await testCompletedReenrollmentsPreserveUserInstitutionScope();
await testCompletedReenrollmentsRejectUserScopeExpansion();
await testCompletedReenrollmentsPreserveSecretaryInstitutionScope();
await testCompletedReenrollmentsPreserveAdminAndSuperAdminGlobalScope();

async function testCompletedReenrollmentsUseAuditAsSourceOfTruth() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, { auditRows: [reenrollmentAudit] });
  const response = await service.listCompletedReenrollments(baseQuery(), admin());

  assert.equal(response.academicYear.id, targetAcademicYear.id);
  assert.equal(response.pagination.total, 1);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0]?.enrollmentId, "enrollment-reenrolled");
  assert.equal(response.data[0]?.student.fullName, "Maria Reenrolada");
  assert.equal(response.data[0]?.student.cpfMasked, "123.***.***-09");
  assert.equal(response.data[0]?.previousEnrollment?.id, "enrollment-previous");
  assert.equal(response.data[0]?.enrollment.institution.id, destinationInstitution.id);
  assert.equal(response.data[0]?.enrollment.academicYear.id, targetAcademicYear.id);
  assert.equal(response.data[0]?.busAssignment?.bus.id, bus.id);
  assert.equal(response.data[0]?.performedBy?.id, "user-operator");

  const auditCall = calls.find((call) => call.model === "administrativeAuditLog.findMany");
  assert.deepEqual(auditCall?.args, {
    where: {
      eventType: AdministrativeAuditEventType.ENROLLMENT_CREATED,
      domain: "enrollments",
      metadata: {
        path: ["reenrollment"],
        equals: true,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 1000,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const targetEnrollmentCall = calls.find(
    (call) =>
      call.model === "enrollment.findMany" &&
      Array.isArray((call.args as { where?: { id?: { in?: string[] } } }).where?.id?.in) &&
      (call.args as { where: { id: { in: string[] } } }).where.id.in.includes("enrollment-reenrolled"),
  );
  assert.deepEqual(
    (targetEnrollmentCall?.args as { where: { id: { in: string[] } } }).where.id.in,
    ["enrollment-reenrolled"],
    "regular destination enrollment must not be queried without reenrollment audit",
  );
  assert.equal(
    (targetEnrollmentCall?.args as { where: { academicYearId?: string } }).where.academicYearId,
    targetAcademicYear.id,
    "academic year filter must apply to the destination enrollment",
  );
}

async function testCompletedReenrollmentsExcludeRegularEnrollment() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, { auditRows: [] });
  const response = await service.listCompletedReenrollments(baseQuery(), admin());

  assert.equal(response.pagination.total, 0);
  assert.equal(response.data.length, 0);
  assert.equal(
    calls.some((call) => call.model === "enrollment.findMany"),
    false,
    "regular enrollments must not be queried when there is no reenrollment audit",
  );
}

async function testCompletedReenrollmentsIgnoreAuditWithoutEnrollmentId() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, {
    auditRows: [
      {
        ...reenrollmentAudit,
        id: "audit-without-enrollment-id",
        metadata: {
          academicYearId: targetAcademicYear.id,
          enrollmentId: "",
          previousEnrollmentId: "enrollment-previous",
          reenrollment: true,
          studentId: "student-1",
        },
        recordId: "enrollment-reenrolled",
      },
    ],
  });
  const response = await service.listCompletedReenrollments(baseQuery(), admin());

  assert.equal(response.pagination.total, 0);
  assert.equal(response.data.length, 0);
  assert.equal(
    calls.some((call) => call.model === "enrollment.findMany"),
    false,
    "audit without metadata.enrollmentId must not pull enrollments by recordId",
  );
}

async function testCompletedReenrollmentsDeduplicateAuditEvents() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, {
    auditRows: [
      reenrollmentAudit,
      {
        ...reenrollmentAudit,
        id: "audit-reenrollment-duplicate",
        createdAt: new Date("2026-01-10T11:00:00.000Z"),
        user: {
          email: "duplicado@atretu.local",
          id: "user-duplicate",
          name: "Duplicado",
        },
        userId: "user-duplicate",
      },
    ],
  });
  const response = await service.listCompletedReenrollments(baseQuery(), admin());

  assert.equal(response.pagination.total, 1);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0]?.enrollmentId, "enrollment-reenrolled");
  assert.equal(response.data[0]?.performedBy?.id, "user-operator");
  assert.equal(response.data[0]?.reenrolledAt.toISOString(), "2026-01-10T12:00:00.000Z");

  const targetEnrollmentCall = calls.find(
    (call) =>
      call.model === "enrollment.findMany" &&
      Array.isArray((call.args as { where?: { id?: { in?: string[] } } }).where?.id?.in) &&
      (call.args as { where: { id: { in: string[] } } }).where.id.in.includes("enrollment-reenrolled"),
  );
  assert.deepEqual(
    (targetEnrollmentCall?.args as { where: { id: { in: string[] } } }).where.id.in,
    ["enrollment-reenrolled"],
  );
}

async function testCompletedReenrollmentsAllowMissingPreviousEnrollmentAndUser() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, {
    auditRows: [
      {
        ...reenrollmentAudit,
        metadata: {
          academicYearId: targetAcademicYear.id,
          enrollmentId: "enrollment-reenrolled",
          previousEnrollmentId: "",
          reenrollment: true,
          studentId: "student-1",
        },
        user: null as never,
        userId: null as never,
      },
    ],
  });
  const response = await service.listCompletedReenrollments(baseQuery(), admin());

  assert.equal(response.pagination.total, 1);
  assert.equal(response.data[0]?.previousEnrollment, null);
  assert.equal(response.data[0]?.performedBy, null);
  assert.equal(
    calls.some(
      (call) =>
        call.model === "enrollment.findMany" &&
        (call.args as { where?: { id?: { in?: string[] } } }).where?.id?.in?.includes("enrollment-previous"),
    ),
    false,
    "missing previousEnrollmentId must not query or invent previous enrollment data",
  );
}

async function testCompletedReenrollmentsPreserveUserInstitutionScope() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, { auditRows: [reenrollmentAudit] });
  const response = await service.listCompletedReenrollments(
    baseQuery(),
    scopedUser([destinationInstitution.id]),
  );

  assert.equal(response.pagination.total, 1);
  const targetEnrollmentCall = enrollmentCallFor(calls, "enrollment-reenrolled");
  assert.equal(
    (targetEnrollmentCall?.args as { where: { institutionId?: string } }).where.institutionId,
    destinationInstitution.id,
  );
}

async function testCompletedReenrollmentsRejectUserScopeExpansion() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, { auditRows: [reenrollmentAudit] });

  await assert.rejects(
    () =>
      service.listCompletedReenrollments(
        { ...baseQuery(), institutionId: destinationInstitution.id },
        scopedUser(["other-institution"]),
      ),
    /Acesso negado/,
  );
}

async function testCompletedReenrollmentsPreserveSecretaryInstitutionScope() {
  const calls: Array<{ model: string; args: unknown }> = [];
  const service = createService(calls, { auditRows: [reenrollmentAudit] });
  const response = await service.listCompletedReenrollments(
    { ...baseQuery(), institutionId: destinationInstitution.id },
    secretary([destinationInstitution.id]),
  );
  assert.equal(response.pagination.total, 1);

  await assert.rejects(
    () =>
      service.listCompletedReenrollments(
        { ...baseQuery(), institutionId: destinationInstitution.id },
        secretary(["other-institution"]),
      ),
    /Acesso negado/,
  );
}

async function testCompletedReenrollmentsPreserveAdminAndSuperAdminGlobalScope() {
  for (const currentUser of [admin(), superAdmin()]) {
    const calls: Array<{ model: string; args: unknown }> = [];
    const service = createService(calls, { auditRows: [reenrollmentAudit] });
    const response = await service.listCompletedReenrollments(baseQuery(), currentUser);

    assert.equal(response.pagination.total, 1);
    const targetEnrollmentCall = enrollmentCallFor(calls, "enrollment-reenrolled");
    assert.equal(
      (targetEnrollmentCall?.args as { where: { institutionId?: string } }).where.institutionId,
      undefined,
      `${currentUser.roles[0]} must keep global scope when no institution filter is requested`,
    );
  }
}

function createService(
  calls: Array<{ model: string; args: unknown }>,
  options: { auditRows: Array<typeof reenrollmentAudit> },
) {
  const prisma = {
    academicYear: {
      findFirst: async () => targetAcademicYear,
      findUnique: async () => targetAcademicYear,
    },
    administrativeAuditLog: {
      findMany: async (args: unknown) => {
        calls.push({ model: "administrativeAuditLog.findMany", args });
        return options.auditRows;
      },
    },
    enrollment: {
      findMany: async (args: { where?: { id?: { in?: string[] }; institutionId?: string | { in: string[] } } }) => {
        calls.push({ model: "enrollment.findMany", args });
        const ids = args.where?.id?.in ?? [];
        if (ids.includes("enrollment-previous")) {
          return [previousEnrollment()];
        }
        const enrollment = completedEnrollment();
        if (!ids.includes(enrollment.id) || !matchesInstitutionFilter(enrollment.institutionId, args.where?.institutionId)) {
          return [];
        }
        return [enrollment];
      },
    },
  };
  return new StudentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function completedEnrollment() {
  return {
    id: "enrollment-reenrolled",
    studentId: "student-1",
    academicYearId: targetAcademicYear.id,
    institutionId: destinationInstitution.id,
    shiftId: shift.id,
    course: "Engenharia",
    grade: "2",
    status: EnrollmentStatus.ACTIVE,
    createdAt: new Date("2026-01-10T12:00:00.000Z"),
    updatedAt: new Date("2026-01-10T12:00:00.000Z"),
    academicYear: targetAcademicYear,
    institution: destinationInstitution,
    shift,
    student: {
      id: "student-1",
      person: {
        fullName: "Maria Reenrolada",
        cpf: "12345678909",
      },
    },
    busAssignments: [
      {
        id: "assignment-1",
        bus,
        note: "Mantem rota",
      },
    ],
  };
}

function previousEnrollment() {
  return {
    id: "enrollment-previous",
    studentId: "student-1",
    academicYearId: previousAcademicYear.id,
    institutionId: previousInstitution.id,
    shiftId: shift.id,
    course: "Tecnico",
    grade: "1",
    status: EnrollmentStatus.ACTIVE,
    createdAt: new Date("2025-01-10T12:00:00.000Z"),
    updatedAt: new Date("2025-01-10T12:00:00.000Z"),
    academicYear: previousAcademicYear,
    institution: previousInstitution,
    shift,
  };
}

function academicYear(id: string, year: number) {
  return {
    id,
    year,
    isCurrent: year === 2026,
    status: AcademicYearStatus.ACTIVE,
    archivedAt: null,
    createdAt: new Date(`${year}-01-01T00:00:00.000Z`),
    updatedAt: new Date(`${year}-01-01T00:00:00.000Z`),
  };
}

function record(id: string, name: string) {
  return {
    id,
    name,
    status: RecordStatus.ACTIVE,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function baseQuery() {
  return {
    boardMembership: StudentBoardMembershipFilter.ALL,
    limit: 20,
    order: SortOrder.ASC,
    page: 1,
    sort: StudentSort.CREATED_AT,
    status: StudentStatusFilter.ACTIVE,
  };
}

function admin(): AuthUser {
  return {
    email: "admin@atretu.local",
    id: "admin",
    institutionIds: [],
    mustChangePassword: false,
    name: "Admin",
    roles: [RoleCode.ADMINISTRATOR],
    status: UserStatus.ACTIVE,
  };
}

function scopedUser(institutionIds: string[]): AuthUser {
  return {
    email: "user@atretu.local",
    id: "user",
    institutionIds,
    mustChangePassword: false,
    name: "User",
    roles: [RoleCode.USER],
    status: UserStatus.ACTIVE,
  };
}

function secretary(institutionIds: string[]): AuthUser {
  return {
    email: "secretaria@atretu.local",
    id: "secretaria",
    institutionIds,
    mustChangePassword: false,
    name: "Secretaria",
    roles: [RoleCode.SECRETARIA],
    status: UserStatus.ACTIVE,
  };
}

function superAdmin(): AuthUser {
  return {
    email: "superadmin@atretu.local",
    id: "super-admin",
    institutionIds: [],
    mustChangePassword: false,
    name: "Super Admin",
    roles: [RoleCode.SUPER_ADMIN],
    status: UserStatus.ACTIVE,
  };
}

function enrollmentCallFor(calls: Array<{ model: string; args: unknown }>, enrollmentId: string) {
  return calls.find(
    (call) =>
      call.model === "enrollment.findMany" &&
      Array.isArray((call.args as { where?: { id?: { in?: string[] } } }).where?.id?.in) &&
      (call.args as { where: { id: { in: string[] } } }).where.id.in.includes(enrollmentId),
  );
}

function matchesInstitutionFilter(
  institutionId: string,
  filter: string | { in: string[] } | undefined,
) {
  if (!filter) {
    return true;
  }
  if (typeof filter === "string") {
    return filter === institutionId;
  }
  return filter.in.includes(institutionId);
}

console.log("Reenrollment reports guard OK");
