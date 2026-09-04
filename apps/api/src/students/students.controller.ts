import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import {
  OperationalRateLimit,
  OperationalRateLimitGuard,
  RATE_LIMITS,
} from "../security/operational-rate-limit.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  CreateAcademicYearDto,
  CreateEnrollmentDto,
  CreateStudentDto,
  EndBoardMembershipDto,
  ListAcademicYearsDto,
  ListStudentDocumentationStatusDto,
  ListStudentLegacyFinancialHistoryDto,
  ListStudentsDto,
  ReactivateStudentDto,
  ReinstateStudentDto,
  ReenrollStudentDto,
  StartBoardMembershipDto,
  SuspendStudentDto,
  TerminateStudentDto,
  UpdateAcademicYearDto,
  UpdateBoardMembershipRoleDto,
  UpdateEnrollmentDto,
  UpdateGuardianDto,
  UpdatePersonDto,
} from "./dto/students.dto.js";
import { StudentsService } from "./students.service.js";

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller()
export class StudentsController {
  constructor(
    @Inject(StudentsService) private readonly students: StudentsService,
  ) {}

  @Get("academic-years")
  @OperationalPermission(
    "students.view",
    "reports.view",
    "finance.invoices.view",
    "collections.view",
  )
  listAcademicYears(@Query() query: ListAcademicYearsDto) {
    return this.students.listAcademicYears(query);
  }

  @Post("academic-years")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  createAcademicYear(
    @Body() body: CreateAcademicYearDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.createAcademicYear(body, user.id);
  }

  @Patch("academic-years/:id")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  updateAcademicYear(
    @Param("id") id: string,
    @Body() body: UpdateAcademicYearDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updateAcademicYear(id, body, user.id);
  }

  @Patch("academic-years/:id/set-current")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  setCurrentAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.setCurrentAcademicYear(id, user.id);
  }

  @Patch("academic-years/:id/archive")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  archiveAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.archiveAcademicYear(id, user.id);
  }

  @Patch("academic-years/:id/reactivate")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  reactivateAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reactivateAcademicYear(id, user.id);
  }

  @Delete("academic-years/:id")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  deleteAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.deleteAcademicYear(id, user.id);
  }

  @Get("students")
  @OperationalPermission("students.view", "reports.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  listStudents(@Query() query: ListStudentsDto, @CurrentUser() user: AuthUser) {
    return this.students.listStudents(query, user);
  }

  @Post("students")
  @OperationalPermission("students.create")
  createStudent(@Body() body: CreateStudentDto, @CurrentUser() user: AuthUser) {
    return this.students.createStudent(body, user.id, user);
  }

  @Get("students/reenrollment-candidates")
  @OperationalPermission("students.reenroll", "reports.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  listReenrollmentCandidates(
    @Query() query: ListStudentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.listReenrollmentCandidates(query, user);
  }

  @Get("students/documentation-status")
  @OperationalPermission("students.view", "reports.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  listStudentDocumentationStatus(
    @Query() query: ListStudentDocumentationStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.listStudentDocumentationStatus(query, user);
  }

  @Get("students/:id")
  @OperationalPermission("students.view")
  getStudent(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.students.getStudent(id, user);
  }

  @Get("students/:id/legacy-financial-history")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  listStudentLegacyFinancialHistory(
    @Param("id") id: string,
    @Query() query: ListStudentLegacyFinancialHistoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.listStudentLegacyFinancialHistory(id, query, user);
  }

  @Get("students/:id/reenrollment-preview")
  @OperationalPermission("students.reenroll")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.preview)
  previewReenrollment(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.students.previewReenrollment(id, academicYearId, user);
  }

  @Patch("students/:id/person")
  @OperationalPermission("students.update")
  updatePerson(
    @Param("id") id: string,
    @Body() body: UpdatePersonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updatePerson(id, body, user.id, user);
  }

  @Patch("students/:id/guardian")
  @OperationalPermission("students.update")
  updateGuardian(
    @Param("id") id: string,
    @Body() body: UpdateGuardianDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updateGuardian(id, body, user.id, user);
  }

  @Post("students/:id/enrollments")
  @OperationalPermission("students.create")
  createEnrollment(
    @Param("id") id: string,
    @Body() body: CreateEnrollmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.createEnrollment(id, body, user.id, user);
  }

  @Patch("students/:id/enrollments/:enrollmentId")
  @OperationalPermission("students.update")
  updateEnrollment(
    @Param("id") id: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() body: UpdateEnrollmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updateEnrollment(id, enrollmentId, body, user.id, user);
  }

  @Post("students/:id/reenroll")
  @OperationalPermission("students.reenroll")
  reenrollStudent(
    @Param("id") id: string,
    @Body() body: ReenrollStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reenrollStudent(id, body, user.id, user);
  }

  @Post("students/:id/suspend")
  @OperationalPermission("students.changeStatus")
  suspendStudent(
    @Param("id") id: string,
    @Body() body: SuspendStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.suspendStudent(id, body, user.id, user);
  }

  @Post("students/:id/reactivate")
  @OperationalPermission("students.changeStatus")
  reactivateStudent(
    @Param("id") id: string,
    @Body() body: ReactivateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reactivateStudent(id, body, user.id, user);
  }

  @Post("students/:id/reinstate")
  @OperationalPermission("students.changeStatus")
  reinstateStudent(
    @Param("id") id: string,
    @Body() body: ReinstateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reinstateStudent(id, body, user.id, user);
  }

  @Post("students/:id/terminate")
  @OperationalPermission("students.changeStatus")
  terminateStudent(
    @Param("id") id: string,
    @Body() body: TerminateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.terminateStudent(id, body, user.id, user);
  }

  @Get("students/:id/history")
  @OperationalPermission("students.view")
  listStudentHistory(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.students.listStudentHistory(id, user);
  }

  @Get("students/:id/board-memberships")
  @OperationalPermission("students.board.view")
  listBoardMemberships(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.students.listBoardMemberships(id, user);
  }

  @Post("students/:id/board-memberships")
  @OperationalPermission("students.board.manage")
  startBoardMembership(
    @Param("id") id: string,
    @Body() body: StartBoardMembershipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.startBoardMembership(id, body, user.id, user);
  }

  @Patch("students/:id/board-memberships/:membershipId/role")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  updateBoardMembershipRole(
    @Param("id") id: string,
    @Param("membershipId") membershipId: string,
    @Body() body: UpdateBoardMembershipRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updateBoardMembershipRole(id, membershipId, body, user.id, user);
  }

  @Post("students/:id/board-memberships/:membershipId/end")
  @OperationalPermission("students.board.manage")
  endBoardMembership(
    @Param("id") id: string,
    @Param("membershipId") membershipId: string,
    @Body() body: EndBoardMembershipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.endBoardMembership(id, membershipId, body, user.id, user);
  }
}
