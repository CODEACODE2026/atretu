import {
  Body,
  Controller,
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
  ListStudentsDto,
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
  listAcademicYears() {
    return this.students.listAcademicYears();
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

  @Get("students/:id")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  getStudent(@Param("id") id: string) {
    return this.students.getStudent(id);
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
}
