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
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  CreateAcademicYearDto,
  CreateEnrollmentDto,
  CreateStudentDto,
  EndBoardMembershipDto,
  ListAcademicYearsDto,
  ListStudentsDto,
  ReactivateStudentDto,
  ReinstateStudentDto,
  ReenrollStudentDto,
  StartBoardMembershipDto,
  SuspendStudentDto,
  TerminateStudentDto,
  UpdateAcademicYearDto,
  UpdateEnrollmentDto,
  UpdateGuardianDto,
  UpdatePersonDto,
} from "./dto/students.dto.js";
import { StudentsService } from "./students.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class StudentsController {
  constructor(
    @Inject(StudentsService) private readonly students: StudentsService,
  ) {}

  @Get("academic-years")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listAcademicYears(@Query() query: ListAcademicYearsDto) {
    return this.students.listAcademicYears(query);
  }

  @Post("academic-years")
  @Roles(RoleCode.SUPER_ADMIN)
  createAcademicYear(
    @Body() body: CreateAcademicYearDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.createAcademicYear(body, user.id);
  }

  @Patch("academic-years/:id")
  @Roles(RoleCode.SUPER_ADMIN)
  updateAcademicYear(
    @Param("id") id: string,
    @Body() body: UpdateAcademicYearDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updateAcademicYear(id, body, user.id);
  }

  @Patch("academic-years/:id/set-current")
  @Roles(RoleCode.SUPER_ADMIN)
  setCurrentAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.setCurrentAcademicYear(id, user.id);
  }

  @Patch("academic-years/:id/archive")
  @Roles(RoleCode.SUPER_ADMIN)
  archiveAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.archiveAcademicYear(id, user.id);
  }

  @Patch("academic-years/:id/reactivate")
  @Roles(RoleCode.SUPER_ADMIN)
  reactivateAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reactivateAcademicYear(id, user.id);
  }

  @Delete("academic-years/:id")
  @Roles(RoleCode.SUPER_ADMIN)
  deleteAcademicYear(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.deleteAcademicYear(id, user.id);
  }

  @Get("students")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listStudents(@Query() query: ListStudentsDto) {
    return this.students.listStudents(query);
  }

  @Post("students")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  createStudent(@Body() body: CreateStudentDto, @CurrentUser() user: AuthUser) {
    return this.students.createStudent(body, user.id);
  }

  @Get("students/reenrollment-candidates")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listReenrollmentCandidates(@Query() query: ListStudentsDto) {
    return this.students.listReenrollmentCandidates(query);
  }

  @Get("students/:id")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  getStudent(@Param("id") id: string) {
    return this.students.getStudent(id);
  }

  @Get("students/:id/reenrollment-preview")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  previewReenrollment(
    @Param("id") id: string,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.students.previewReenrollment(id, academicYearId);
  }

  @Patch("students/:id/person")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  updatePerson(
    @Param("id") id: string,
    @Body() body: UpdatePersonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updatePerson(id, body, user.id);
  }

  @Patch("students/:id/guardian")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  updateGuardian(
    @Param("id") id: string,
    @Body() body: UpdateGuardianDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updateGuardian(id, body, user.id);
  }

  @Post("students/:id/enrollments")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  createEnrollment(
    @Param("id") id: string,
    @Body() body: CreateEnrollmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.createEnrollment(id, body, user.id);
  }

  @Patch("students/:id/enrollments/:enrollmentId")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  updateEnrollment(
    @Param("id") id: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() body: UpdateEnrollmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.updateEnrollment(id, enrollmentId, body, user.id);
  }

  @Post("students/:id/reenroll")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  reenrollStudent(
    @Param("id") id: string,
    @Body() body: ReenrollStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reenrollStudent(id, body, user.id);
  }

  @Post("students/:id/suspend")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  suspendStudent(
    @Param("id") id: string,
    @Body() body: SuspendStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.suspendStudent(id, body, user.id);
  }

  @Post("students/:id/reactivate")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  reactivateStudent(
    @Param("id") id: string,
    @Body() body: ReactivateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reactivateStudent(id, body, user.id);
  }

  @Post("students/:id/reinstate")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  reinstateStudent(
    @Param("id") id: string,
    @Body() body: ReinstateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.reinstateStudent(id, body, user.id);
  }

  @Post("students/:id/terminate")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  terminateStudent(
    @Param("id") id: string,
    @Body() body: TerminateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.terminateStudent(id, body, user.id);
  }

  @Get("students/:id/history")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listStudentHistory(@Param("id") id: string) {
    return this.students.listStudentHistory(id);
  }

  @Get("students/:id/board-memberships")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listBoardMemberships(@Param("id") id: string) {
    return this.students.listBoardMemberships(id);
  }

  @Post("students/:id/board-memberships")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  startBoardMembership(
    @Param("id") id: string,
    @Body() body: StartBoardMembershipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.startBoardMembership(id, body, user.id);
  }

  @Post("students/:id/board-memberships/:membershipId/end")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  endBoardMembership(
    @Param("id") id: string,
    @Param("membershipId") membershipId: string,
    @Body() body: EndBoardMembershipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.endBoardMembership(id, membershipId, body, user.id);
  }
}
