import assert from "node:assert/strict";
import {
  BoardMembershipStatus,
  RoleCode,
  StudentStatus,
  UserStatus,
} from "@prisma/client";
import { StudentsService } from "./students.service.js";
import {
  SortOrder,
  StudentBoardMembershipFilter,
  StudentSort,
  StudentStatusFilter,
} from "./dto/students.dto.js";
import type { AuthUser } from "../users/users.service.js";

const service = new StudentsService(
  {} as never,
  {} as never,
  {} as never,
  {} as never,
);

const buildStudentWhere = (
  query: Parameters<StudentsService["listStudents"]>[0],
  user?: AuthUser,
) => (service as never as { buildStudentWhere: Function }).buildStudentWhere(query, user);

const buildStudentSqlWhere = (
  query: Parameters<StudentsService["listStudents"]>[0],
  user?: AuthUser,
) =>
  (
    service as unknown as {
      buildStudentSqlWhere: (
        query: Parameters<StudentsService["listStudents"]>[0],
        user?: AuthUser,
      ) => { text: string; values: unknown[] };
    }
  ).buildStudentSqlWhere(query, user);

const secretary: AuthUser = {
  email: "secretaria@atretu.local",
  id: "user-secretaria",
  institutionIds: ["11111111-1111-1111-1111-111111111111"],
  mustChangePassword: false,
  name: "Secretaria",
  roles: [RoleCode.SECRETARIA],
  status: UserStatus.ACTIVE,
};

const activeWhere = buildStudentWhere({
  boardMembership: StudentBoardMembershipFilter.ACTIVE,
  limit: 10,
  order: SortOrder.ASC,
  page: 1,
  sort: StudentSort.NAME,
  status: StudentStatusFilter.ALL,
});
assert.deepEqual(activeWhere.boardMemberships, {
  some: { status: BoardMembershipStatus.ACTIVE },
});

const inactiveWhere = buildStudentWhere({
  boardMembership: StudentBoardMembershipFilter.INACTIVE,
  limit: 10,
  order: SortOrder.ASC,
  page: 1,
  sort: StudentSort.NAME,
  status: StudentStatusFilter.ALL,
});
assert.deepEqual(inactiveWhere.boardMemberships, {
  none: { status: BoardMembershipStatus.ACTIVE },
});

const allWhere = buildStudentWhere({
  boardMembership: StudentBoardMembershipFilter.ALL,
  limit: 10,
  order: SortOrder.ASC,
  page: 1,
  sort: StudentSort.NAME,
  status: StudentStatusFilter.ALL,
});
assert.equal(allWhere.boardMemberships, undefined);

const combinedWhere = buildStudentWhere(
  {
    academicYearId: "22222222-2222-2222-2222-222222222222",
    boardMembership: StudentBoardMembershipFilter.ACTIVE,
    institutionId: "11111111-1111-1111-1111-111111111111",
    limit: 10,
    order: SortOrder.ASC,
    page: 1,
    search: "Maria 123",
    shiftId: "33333333-3333-3333-3333-333333333333",
    sort: StudentSort.NAME,
    status: StudentStatusFilter.ACTIVE,
  },
  secretary,
);
assert.equal(combinedWhere.status, StudentStatus.ACTIVE);
assert.deepEqual(combinedWhere.boardMemberships, {
  some: { status: BoardMembershipStatus.ACTIVE },
});
assert.deepEqual(combinedWhere.enrollments, {
  some: {
    academicYearId: "22222222-2222-2222-2222-222222222222",
    institutionId: "11111111-1111-1111-1111-111111111111",
    shiftId: "33333333-3333-3333-3333-333333333333",
  },
});
assert.ok(Array.isArray(combinedWhere.OR), "search must still be combined");

const activeSql = buildStudentSqlWhere({
  boardMembership: StudentBoardMembershipFilter.ACTIVE,
  limit: 10,
  order: SortOrder.ASC,
  page: 1,
  sort: StudentSort.CARD_NUMBER,
  status: StudentStatusFilter.ALL,
});
assert.match(activeSql.text, /EXISTS\s+\(\s+SELECT 1\s+FROM board_memberships bm/i);
assert.match(activeSql.text, /bm\.student_id = s\.id/i);
assert.match(activeSql.text, /bm\.status = \$1::"BoardMembershipStatus"/i);
assert.deepEqual(activeSql.values, [BoardMembershipStatus.ACTIVE]);

const inactiveSql = buildStudentSqlWhere({
  boardMembership: StudentBoardMembershipFilter.INACTIVE,
  limit: 10,
  order: SortOrder.ASC,
  page: 1,
  sort: StudentSort.CARD_NUMBER,
  status: StudentStatusFilter.ALL,
});
assert.match(inactiveSql.text, /NOT EXISTS\s+\(\s+SELECT 1\s+FROM board_memberships bm/i);
assert.deepEqual(inactiveSql.values, [BoardMembershipStatus.ACTIVE]);

const scopedSql = buildStudentSqlWhere(
  {
    academicYearId: "22222222-2222-2222-2222-222222222222",
    boardMembership: StudentBoardMembershipFilter.INACTIVE,
    institutionId: "11111111-1111-1111-1111-111111111111",
    limit: 10,
    order: SortOrder.ASC,
    page: 2,
    search: "Maria",
    shiftId: "33333333-3333-3333-3333-333333333333",
    sort: StudentSort.CARD_NUMBER,
    status: StudentStatusFilter.ACTIVE,
  },
  secretary,
);
assert.match(scopedSql.text, /NOT EXISTS\s+\(\s+SELECT 1\s+FROM board_memberships bm/i);
assert.match(scopedSql.text, /EXISTS\s+\(\s+SELECT 1\s+FROM enrollments e/i);
assert.match(scopedSql.text, /e\.institution_id = \$\d+::uuid/i);
assert.match(scopedSql.text, /e\.academic_year_id = \$\d+::uuid/i);
assert.match(scopedSql.text, /e\.shift_id = \$\d+::uuid/i);

console.log("Students board membership filter guard OK");
