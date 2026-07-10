import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  Prisma,
  RecordStatus,
  RoleCode,
} from "@prisma/client";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthUser } from "../users/users.service.js";
import { isValidCpf, maskCpf, normalizeCpf } from "./cpf.js";
import {
  CreateAcademicYearDto,
  CreateEnrollmentDto,
  CreateStudentDto,
  EnrollmentInputDto,
  GuardianInputDto,
  ListStudentsDto,
  SortOrder,
  StudentSort,
  UpdateAcademicYearDto,
  UpdateEnrollmentDto,
  UpdateGuardianDto,
  UpdatePersonDto,
} from "./dto/students.dto.js";

type PrismaTx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class StudentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  async listAcademicYears() {
    const data = await this.prisma.academicYear.findMany({
      orderBy: [{ year: "desc" }],
    });
    return { data };
  }

  async createAcademicYear(body: CreateAcademicYearDto, userId: string) {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        if (body.isCurrent) {
          await tx.academicYear.updateMany({
            where: { isCurrent: true },
            data: { isCurrent: false },
          });
        }

        return tx.academicYear.create({
          data: { year: body.year, isCurrent: body.isCurrent ?? false },
        });
      });

      await this.recordAudit(
        AdministrativeAuditEventType.ACADEMIC_YEAR_CREATED,
        "academic_years",
        record.id,
        userId,
        { academicYearId: record.id },
      );
      return record;
    } catch (error) {
      this.handleWriteError(error, "Ano Letivo ja cadastrado");
    }
  }

  async updateAcademicYear(
    id: string,
    body: UpdateAcademicYearDto,
    userId: string,
  ) {
    await this.ensureAcademicYear(id);
    try {
      const record = await this.prisma.academicYear.update({
        where: { id },
        data: body,
      });
      await this.recordAudit(
        AdministrativeAuditEventType.ACADEMIC_YEAR_UPDATED,
        "academic_years",
        record.id,
        userId,
        { academicYearId: record.id, changedFields: Object.keys(body).join(",") },
      );
      return record;
    } catch (error) {
      this.handleWriteError(error, "Ano Letivo ja cadastrado");
    }
  }

  async setCurrentAcademicYear(id: string, userId: string) {
    await this.ensureAcademicYear(id);
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      });
    });

    await this.recordAudit(
      AdministrativeAuditEventType.ACADEMIC_YEAR_CURRENT_CHANGED,
      "academic_years",
      record.id,
      userId,
      { academicYearId: record.id },
    );
    return record;
  }

  async listStudents(query: ListStudentsDto) {
    const where = this.buildStudentWhere(query);
    const orderBy = this.buildStudentOrderBy(query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy,
        skip,
        take: query.limit,
        include: this.studentSummaryInclude(),
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: data.map((student) => this.toStudentSummary(student)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async createStudent(body: CreateStudentDto, userId: string) {
    const personData = this.preparePerson(body.person);
    const guardianData = body.guardian
      ? this.prepareGuardian(body.guardian)
      : undefined;
    const joinedAt = body.joinedAt
      ? this.parsePastOrTodayDate(body.joinedAt, "Data de ingresso invalida")
      : undefined;

    try {
      const student = await this.prisma.$transaction(async (tx) => {
        await this.ensureEnrollmentReferences(tx, body.enrollment);

        const person = await tx.person.create({ data: personData });
        const createdStudent = await tx.student.create({
          data: {
            personId: person.id,
            joinedAt,
            guardian: guardianData ? { create: guardianData } : undefined,
            enrollments: {
              create: this.toEnrollmentCreateData(body.enrollment),
            },
          },
          include: this.studentDetailInclude(),
        });

        return createdStudent;
      });

      await this.recordAudit(
        AdministrativeAuditEventType.STUDENT_CREATED,
        "students",
        student.id,
        userId,
        { studentId: student.id },
      );
      await this.recordAudit(
        AdministrativeAuditEventType.ENROLLMENT_CREATED,
        "enrollments",
        student.enrollments[0]?.id ?? student.id,
        userId,
        {
          studentId: student.id,
          enrollmentId: student.enrollments[0]?.id ?? "",
        },
      );

      return this.toStudentDetail(student);
    } catch (error) {
      this.handleWriteError(error, "CPF ja cadastrado");
    }
  }

  async getStudent(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: this.studentDetailInclude(),
    });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }

    return this.toStudentDetail(student);
  }

  async updatePerson(id: string, body: UpdatePersonDto, userId: string) {
    const student = await this.ensureStudent(id);
    const personData = this.preparePerson(body);

    try {
      const person = await this.prisma.person.update({
        where: { id: student.personId },
        data: personData,
      });
      await this.recordAudit(
        AdministrativeAuditEventType.PERSON_UPDATED,
        "people",
        person.id,
        userId,
        {
          studentId: student.id,
          changedFields: Object.keys(personData).join(","),
        },
      );
      return this.getStudent(id);
    } catch (error) {
      this.handleWriteError(error, "CPF ja cadastrado");
    }
  }

  async updateGuardian(id: string, body: UpdateGuardianDto, userId: string) {
    await this.ensureStudent(id);

    if (body.clear) {
      await this.prisma.studentGuardian.deleteMany({ where: { studentId: id } });
    } else if (body.guardian) {
      const guardianData = this.prepareGuardian(body.guardian);
      await this.prisma.studentGuardian.upsert({
        where: { studentId: id },
        create: { ...guardianData, studentId: id },
        update: guardianData,
      });
    } else {
      throw new BadRequestException("Informe o responsavel ou remocao");
    }

    await this.recordAudit(
      AdministrativeAuditEventType.GUARDIAN_UPDATED,
      "student_guardians",
      id,
      userId,
      { studentId: id },
    );
    return this.getStudent(id);
  }

  async createEnrollment(
    studentId: string,
    body: CreateEnrollmentDto,
    userId: string,
  ) {
    await this.ensureStudent(studentId);
    try {
      const enrollment = await this.prisma.$transaction(async (tx) => {
        await this.ensureEnrollmentReferences(tx, body);
        return tx.enrollment.create({
          data: { ...this.toEnrollmentCreateData(body), studentId },
          include: this.enrollmentInclude(),
        });
      });
      await this.recordAudit(
        AdministrativeAuditEventType.ENROLLMENT_CREATED,
        "enrollments",
        enrollment.id,
        userId,
        { studentId, enrollmentId: enrollment.id },
      );
      return this.toEnrollment(enrollment);
    } catch (error) {
      this.handleWriteError(error, "Academico ja possui matricula neste Ano Letivo");
    }
  }

  async updateEnrollment(
    studentId: string,
    enrollmentId: string,
    body: UpdateEnrollmentDto,
    userId: string,
  ) {
    await this.ensureStudent(studentId);
    const current = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, studentId },
    });
    if (!current) {
      throw new NotFoundException("Matricula nao encontrada");
    }

    const data: Prisma.EnrollmentUncheckedUpdateInput = {};
    if (body.academicYearId) {
      await this.ensureAcademicYear(body.academicYearId);
      data.academicYearId = body.academicYearId;
    }
    if (body.institutionId) {
      await this.ensureActiveInstitution(body.institutionId);
      data.institutionId = body.institutionId;
    }
    if (body.shiftId) {
      await this.ensureActiveShift(body.shiftId);
      data.shiftId = body.shiftId;
    }
    if (body.course) {
      data.course = body.course;
    }
    if (body.grade) {
      data.grade = body.grade;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Informe ao menos um campo para atualizar");
    }

    try {
      const enrollment = await this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data,
        include: this.enrollmentInclude(),
      });
      await this.recordAudit(
        AdministrativeAuditEventType.ENROLLMENT_UPDATED,
        "enrollments",
        enrollment.id,
        userId,
        {
          studentId,
          enrollmentId: enrollment.id,
          changedFields: Object.keys(data).join(","),
        },
      );
      return this.toEnrollment(enrollment);
    } catch (error) {
      this.handleWriteError(error, "Academico ja possui matricula neste Ano Letivo");
    }
  }

  assertCanWriteAcademicYear(user: AuthUser) {
    if (!user.roles.includes(RoleCode.SUPER_ADMIN)) {
      throw new BadRequestException("Somente Super Admin altera Ano Letivo");
    }
  }

  private buildStudentWhere(query: ListStudentsDto): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};
    if (query.search) {
      const normalizedSearch = this.normalizeName(query.search);
      const cpfSearch = normalizeCpf(query.search);
      where.OR = [
        { person: { normalizedName: { contains: normalizedSearch } } },
        ...(cpfSearch ? [{ person: { cpf: { contains: cpfSearch } } }] : []),
      ];
    }

    const enrollmentFilters: Prisma.EnrollmentWhereInput = {};
    if (query.academicYearId) {
      enrollmentFilters.academicYearId = query.academicYearId;
    }
    if (query.institutionId) {
      enrollmentFilters.institutionId = query.institutionId;
    }
    if (query.shiftId) {
      enrollmentFilters.shiftId = query.shiftId;
    }

    if (Object.keys(enrollmentFilters).length > 0) {
      where.enrollments = { some: enrollmentFilters };
    }

    return where;
  }

  private buildStudentOrderBy(
    query: ListStudentsDto,
  ): Prisma.StudentOrderByWithRelationInput[] {
    const direction = query.order === SortOrder.DESC ? "desc" : "asc";
    if (query.sort === StudentSort.CREATED_AT) {
      return [{ createdAt: direction }, { person: { normalizedName: "asc" } }];
    }
    if (query.sort === StudentSort.JOINED_AT) {
      return [{ joinedAt: direction }, { person: { normalizedName: "asc" } }];
    }
    return [{ person: { normalizedName: direction } }, { createdAt: "desc" }];
  }

  private preparePerson(input: UpdatePersonDto) {
    const cpf = normalizeCpf(input.cpf);
    if (!isValidCpf(cpf)) {
      throw new BadRequestException("CPF invalido");
    }

    const birthDate = this.parsePastOrTodayDate(
      input.birthDate,
      "Data de nascimento invalida",
    );

    return {
      fullName: input.fullName,
      normalizedName: this.normalizeName(input.fullName),
      cpf,
      rg: this.optional(input.rg),
      birthDate,
      phone: this.optional(input.phone),
      email: this.optional(input.email),
      addressStreet: input.addressStreet,
      addressNumber: input.addressNumber,
      addressNeighborhood: input.addressNeighborhood,
      addressCity: input.addressCity,
      addressZipCode: this.optional(input.addressZipCode),
      addressState: this.optional(input.addressState),
      addressComplement: this.optional(input.addressComplement),
    };
  }

  private prepareGuardian(input: GuardianInputDto) {
    const cpf = input.cpf ? normalizeCpf(input.cpf) : undefined;
    if (cpf && !isValidCpf(cpf)) {
      throw new BadRequestException("CPF do responsavel invalido");
    }

    return {
      fullName: input.fullName,
      cpf,
      rg: this.optional(input.rg),
    };
  }

  private toEnrollmentCreateData(input: EnrollmentInputDto) {
    return {
      academicYearId: input.academicYearId,
      institutionId: input.institutionId,
      shiftId: input.shiftId,
      course: input.course,
      grade: input.grade,
    };
  }

  private async ensureEnrollmentReferences(tx: PrismaTx, input: EnrollmentInputDto) {
    await Promise.all([
      this.ensureAcademicYear(input.academicYearId, tx),
      this.ensureActiveInstitution(input.institutionId, tx),
      this.ensureActiveShift(input.shiftId, tx),
    ]);
  }

  private async ensureAcademicYear(id: string, tx: PrismaTx = this.prisma) {
    const record = await tx.academicYear.findUnique({ where: { id } });
    if (!record) {
      throw new BadRequestException("Ano Letivo invalido");
    }
    return record;
  }

  private async ensureActiveInstitution(id: string, tx: PrismaTx = this.prisma) {
    const record = await tx.institution.findUnique({ where: { id } });
    if (!record || record.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Instituicao ativa obrigatoria");
    }
    return record;
  }

  private async ensureActiveShift(id: string, tx: PrismaTx = this.prisma) {
    const record = await tx.shift.findUnique({ where: { id } });
    if (!record || record.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Turno ativo obrigatorio");
    }
    return record;
  }

  private async ensureStudent(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }
    return student;
  }

  private studentSummaryInclude() {
    return {
      person: true,
      enrollments: {
        orderBy: { academicYear: { year: "desc" } },
        take: 1,
        include: this.enrollmentInclude(),
      },
    } satisfies Prisma.StudentInclude;
  }

  private studentDetailInclude() {
    return {
      person: true,
      guardian: true,
      enrollments: {
        orderBy: { academicYear: { year: "desc" } },
        include: this.enrollmentInclude(),
      },
    } satisfies Prisma.StudentInclude;
  }

  private enrollmentInclude() {
    return {
      academicYear: true,
      institution: true,
      shift: true,
    } satisfies Prisma.EnrollmentInclude;
  }

  private toStudentSummary(student: StudentWithSummary) {
    const enrollment = student.enrollments[0];
    return {
      id: student.id,
      status: student.status,
      joinedAt: student.joinedAt,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      person: {
        id: student.person.id,
        fullName: student.person.fullName,
        cpfMasked: maskCpf(student.person.cpf),
      },
      currentEnrollment: enrollment ? this.toEnrollment(enrollment) : null,
    };
  }

  private toStudentDetail(student: StudentWithDetail) {
    return {
      id: student.id,
      status: student.status,
      joinedAt: student.joinedAt,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      person: student.person,
      guardian: student.guardian,
      enrollments: student.enrollments.map((enrollment) =>
        this.toEnrollment(enrollment),
      ),
    };
  }

  private toEnrollment(enrollment: EnrollmentWithRelations) {
    return {
      id: enrollment.id,
      status: enrollment.status,
      course: enrollment.course,
      grade: enrollment.grade,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
      academicYear: enrollment.academicYear,
      institution: enrollment.institution,
      shift: enrollment.shift,
    };
  }

  private parsePastOrTodayDate(value: string, message: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date > today) {
      throw new BadRequestException(message);
    }
    return date;
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  private optional(value?: string) {
    return value && value.length > 0 ? value : undefined;
  }

  private async recordAudit(
    eventType: AdministrativeAuditEventType,
    domain: string,
    recordId: string,
    userId: string,
    metadata: Record<string, string | number | boolean>,
  ) {
    await this.audit.record({ eventType, domain, recordId, userId, metadata });
  }

  private handleWriteError(error: unknown, conflictMessage: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(conflictMessage);
    }
    throw error;
  }
}

type StudentWithSummary = Prisma.StudentGetPayload<{
  include: ReturnType<StudentsService["studentSummaryInclude"]>;
}>;

type StudentWithDetail = Prisma.StudentGetPayload<{
  include: ReturnType<StudentsService["studentDetailInclude"]>;
}>;

type EnrollmentWithRelations = Prisma.EnrollmentGetPayload<{
  include: ReturnType<StudentsService["enrollmentInclude"]>;
}>;
