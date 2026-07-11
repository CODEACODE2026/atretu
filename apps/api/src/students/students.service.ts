import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BoardMembershipStatus,
  BusAssignmentEndReason,
  BusAssignmentEventType,
  BusAssignmentStatus,
  Prisma,
  RecordStatus,
  RoleCode,
  StudentCardInvalidationReason,
  StudentCardStatus,
  StudentCardType,
  StudentHistoryEventType,
  StudentStatus,
} from "@prisma/client";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthUser } from "../users/users.service.js";
import { isValidCpf, maskCpf, normalizeCpf } from "./cpf.js";
import {
  canReceiveFutureInvoices,
  getReenrollmentBlockingReason,
} from "./lifecycle.js";
import {
  CreateAcademicYearDto,
  CreateEnrollmentDto,
  CreateStudentDto,
  EndBoardMembershipDto,
  EnrollmentInputDto,
  GuardianInputDto,
  ListStudentsDto,
  ReactivateStudentDto,
  ReenrollStudentDto,
  SortOrder,
  StartBoardMembershipDto,
  StudentSort,
  StudentStatusFilter,
  SuspendStudentDto,
  TerminateStudentDto,
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
    const pagination = this.resolvePagination(query);
    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
        include: this.studentSummaryInclude(),
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: data.map((student) => this.toStudentSummary(student)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
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

  async listReenrollmentCandidates(query: ListStudentsDto) {
    const academicYear = await this.resolveTargetAcademicYear(query.academicYearId);
    const where = this.buildStudentWhere({
      ...query,
      status: StudentStatusFilter.ACTIVE,
      academicYearId: undefined,
    });
    where.status = StudentStatus.ACTIVE;
    where.enrollments = {
      some: {},
      none: { academicYearId: academicYear.id },
    };

    const orderBy = this.buildStudentOrderBy(query);
    const pagination = this.resolvePagination(query);
    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
        include: this.studentSummaryInclude(),
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: data.map((student) => this.toStudentSummary(student)),
      academicYear,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async previewReenrollment(id: string, academicYearId?: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: this.studentDetailInclude(),
    });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }

    const academicYear = await this.resolveTargetAcademicYear(academicYearId);
    const previousEnrollment = student.enrollments[0] ?? null;
    const existingEnrollment = student.enrollments.find(
      (enrollment) => enrollment.academicYear.id === academicYear.id,
    );
    const previousBusAssignment = previousEnrollment
      ? await this.prisma.busAssignment.findFirst({
          where: {
            enrollmentId: previousEnrollment.id,
            status: BusAssignmentStatus.ACTIVE,
          },
          include: { bus: true },
        })
      : null;

    return {
      student: this.toStudentDetail(student),
      academicYear,
      previousEnrollment: previousEnrollment
        ? this.toEnrollment(previousEnrollment)
        : null,
      previousBusAssignment: previousBusAssignment
        ? {
            id: previousBusAssignment.id,
            bus: previousBusAssignment.bus,
            note: previousBusAssignment.note,
          }
        : null,
      eligible:
        getReenrollmentBlockingReason({
          status: student.status,
          hasEnrollmentInTargetYear: Boolean(existingEnrollment),
        }) === null,
      blockingReason: getReenrollmentBlockingReason({
        status: student.status,
        hasEnrollmentInTargetYear: Boolean(existingEnrollment),
      }),
    };
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

  async reenrollStudent(id: string, body: ReenrollStudentDto, userId: string) {
    try {
      const enrollment = await this.prisma.$transaction(async (tx) => {
        const student = await this.lockStudent(tx, id);
        const statusBlock = getReenrollmentBlockingReason({
          status: student.status,
          hasEnrollmentInTargetYear: false,
        });
        if (statusBlock) {
          throw new BadRequestException(statusBlock);
        }

        const academicYear = await this.resolveTargetAcademicYear(
          body.academicYearId,
          tx,
        );
        const existingEnrollment = await tx.enrollment.findUnique({
          where: {
            studentId_academicYearId: {
              studentId: id,
              academicYearId: academicYear.id,
            },
          },
        });
        if (existingEnrollment) {
          const block = getReenrollmentBlockingReason({
            status: student.status,
            hasEnrollmentInTargetYear: true,
          });
          throw new ConflictException(block ?? "Matricula duplicada");
        }

        await this.ensureEnrollmentReferences(tx, {
          academicYearId: academicYear.id,
          institutionId: body.institutionId,
          shiftId: body.shiftId,
          course: body.course,
          grade: body.grade,
        });

        const previousEnrollment = await this.findOperationalEnrollment(tx, id);
        const previousAssignment = previousEnrollment
          ? await this.findActiveBusAssignment(tx, previousEnrollment.id)
          : null;

        if (body.busId) {
          await this.lockBus(tx, body.busId);
          const bus = await this.ensureActiveBus(tx, body.busId);
          await this.ensureBusHasSeat(tx, bus.id, academicYear.id);
        }

        const created = await tx.enrollment.create({
          data: {
            studentId: id,
            academicYearId: academicYear.id,
            institutionId: body.institutionId,
            shiftId: body.shiftId,
            course: body.course,
            grade: body.grade,
          },
          include: this.enrollmentInclude(),
        });

        let createdAssignment:
          | { id: string; busId: string; enrollmentId: string }
          | undefined;
        if (body.busId) {
          createdAssignment = await tx.busAssignment.create({
            data: {
              enrollmentId: created.id,
              busId: body.busId,
              note: this.optional(body.note),
            },
          });
          await tx.busAssignmentEvent.create({
            data: {
              enrollmentId: created.id,
              busAssignmentId: createdAssignment.id,
              toBusId: body.busId,
              eventType: BusAssignmentEventType.LINKED,
              note: this.optional(body.note),
            },
          });
          await this.recordAuditTx(tx, {
            eventType: AdministrativeAuditEventType.BUS_ASSIGNMENT_LINKED,
            domain: "bus_assignments",
            recordId: createdAssignment.id,
            userId,
            metadata: {
              studentId: id,
              enrollmentId: created.id,
              busAssignmentId: createdAssignment.id,
              busId: body.busId,
              academicYearId: academicYear.id,
            },
          });
        }

        await tx.studentHistoryEvent.create({
          data: {
            studentId: id,
            eventType: StudentHistoryEventType.STUDENT_REENROLLED,
            justification: this.optional(body.note),
            busSeatReleased: false,
            busId: createdAssignment?.busId,
            busAssignmentId: createdAssignment?.id,
            performedByUserId: userId,
          },
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.ENROLLMENT_CREATED,
          domain: "enrollments",
          recordId: created.id,
          userId,
          metadata: {
            studentId: id,
            enrollmentId: created.id,
            academicYearId: academicYear.id,
            reenrollment: true,
          },
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.STUDENT_REENROLLED,
          domain: "students",
          recordId: id,
          userId,
          metadata: {
            studentId: id,
            previousEnrollmentId: previousEnrollment?.id ?? "",
            previousBusAssignmentId: previousAssignment?.id ?? "",
            previousBusId: previousAssignment?.busId ?? "",
            enrollmentId: created.id,
            academicYearId: academicYear.id,
            busAssignmentId: createdAssignment?.id ?? "",
            busId: createdAssignment?.busId ?? "",
            hasBus: Boolean(createdAssignment),
          },
        });

        return created;
      });

      return this.toEnrollment(enrollment);
    } catch (error) {
      this.handleWriteError(error, "Academico ja possui matricula neste Ano Letivo");
    }
  }

  async suspendStudent(id: string, body: SuspendStudentDto, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const student = await this.lockStudent(tx, id);
      if (student.status !== StudentStatus.ACTIVE) {
        throw new BadRequestException("Somente academico ativo pode ser suspenso");
      }

      const enrollment = await this.findOperationalEnrollment(tx, id);
      const activeAssignment = enrollment
        ? await this.findActiveBusAssignment(tx, enrollment.id)
        : null;
      let affectedAssignmentId: string | undefined;
      let affectedBusId: string | undefined;

      if (body.releaseBusSeat && activeAssignment) {
        await this.lockBus(tx, activeAssignment.busId);
        const ended = await tx.busAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            status: BusAssignmentStatus.ENDED,
            endedAt: new Date(),
            endReason: BusAssignmentEndReason.SUSPENSION,
            note: body.justification,
          },
        });
        await tx.busAssignmentEvent.create({
          data: {
            enrollmentId: enrollment!.id,
            busAssignmentId: ended.id,
            fromBusId: activeAssignment.busId,
            eventType: BusAssignmentEventType.SUSPENSION_RELEASED,
            note: body.justification,
          },
        });
        affectedAssignmentId = ended.id;
        affectedBusId = activeAssignment.busId;
      } else if (activeAssignment) {
        affectedAssignmentId = activeAssignment.id;
        affectedBusId = activeAssignment.busId;
      }

      await tx.student.update({
        where: { id },
        data: { status: StudentStatus.SUSPENDED },
      });

      await tx.studentHistoryEvent.create({
        data: {
          studentId: id,
          eventType: StudentHistoryEventType.STUDENT_SUSPENDED,
          suspensionReason: body.reason,
          justification: body.justification,
          busSeatReleased: body.releaseBusSeat,
          busId: affectedBusId,
          busAssignmentId: affectedAssignmentId,
          performedByUserId: userId,
        },
      });

      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.STUDENT_SUSPENDED,
        domain: "students",
        recordId: id,
        userId,
        metadata: {
          studentId: id,
          enrollmentId: enrollment?.id ?? "",
          busAssignmentId: affectedAssignmentId ?? "",
          busId: affectedBusId ?? "",
          releaseBusSeat: body.releaseBusSeat,
        },
      });
    });

    await result;
    return this.getStudent(id);
  }

  async reactivateStudent(id: string, body: ReactivateStudentDto, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const student = await this.lockStudent(tx, id);
      if (student.status !== StudentStatus.SUSPENDED) {
        throw new BadRequestException("Somente academico suspenso pode ser reativado");
      }

      const lastSuspension = await tx.studentHistoryEvent.findFirst({
        where: {
          studentId: id,
          eventType: StudentHistoryEventType.STUDENT_SUSPENDED,
        },
        orderBy: { occurredAt: "desc" },
      });
      if (!lastSuspension) {
        throw new BadRequestException("Historico de suspensao nao encontrado");
      }

      const enrollment = await this.findOperationalEnrollment(tx, id);
      if (!enrollment) {
        throw new BadRequestException("Matricula anual obrigatoria para reativacao");
      }

      let activeAssignment = await this.findActiveBusAssignment(tx, enrollment.id);
      let newAssignmentId: string | undefined;
      let busId: string | undefined;

      if (lastSuspension.busSeatReleased) {
        if (!body.busId) {
          throw new BadRequestException("Onibus ativo com vaga obrigatorio");
        }
        if (activeAssignment) {
          throw new ConflictException("Matricula ja possui onibus ativo");
        }
        await this.lockBus(tx, body.busId);
        const bus = await this.ensureActiveBus(tx, body.busId);
        await this.ensureBusHasSeat(tx, bus.id, enrollment.academicYearId);
        activeAssignment = await tx.busAssignment.create({
          data: {
            enrollmentId: enrollment.id,
            busId: bus.id,
            note: body.note,
          },
        });
        await tx.busAssignmentEvent.create({
          data: {
            enrollmentId: enrollment.id,
            busAssignmentId: activeAssignment.id,
            toBusId: bus.id,
            eventType: BusAssignmentEventType.LINKED,
            note: body.note,
          },
        });
        newAssignmentId = activeAssignment.id;
        busId = bus.id;
      } else {
        if (!activeAssignment) {
          throw new BadRequestException("Vinculo de onibus ativo esperado");
        }
        busId = activeAssignment.busId;
      }

      await tx.student.update({
        where: { id },
        data: { status: StudentStatus.ACTIVE },
      });
      await tx.studentHistoryEvent.create({
        data: {
          studentId: id,
          eventType: StudentHistoryEventType.STUDENT_REACTIVATED,
          justification: body.note,
          busSeatReleased: lastSuspension.busSeatReleased,
          busId,
          busAssignmentId: newAssignmentId ?? activeAssignment?.id,
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.STUDENT_REACTIVATED,
        domain: "students",
        recordId: id,
        userId,
        metadata: {
          studentId: id,
          enrollmentId: enrollment.id,
          busAssignmentId: newAssignmentId ?? activeAssignment?.id ?? "",
          busId: busId ?? "",
          busSeatWasReleased: Boolean(lastSuspension.busSeatReleased),
        },
      });
    });

    await result;
    return this.getStudent(id);
  }

  async terminateStudent(id: string, body: TerminateStudentDto, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const student = await this.lockStudent(tx, id);
      if (student.status === StudentStatus.TERMINATED) {
        throw new BadRequestException("Academico ja desligado");
      }

      const enrollment = await this.findOperationalEnrollment(tx, id);
      const activeAssignment = enrollment
        ? await this.findActiveBusAssignment(tx, enrollment.id)
        : null;
      let affectedAssignmentId: string | undefined;
      let affectedBusId: string | undefined;

      if (activeAssignment && enrollment) {
        await this.lockBus(tx, activeAssignment.busId);
        const ended = await tx.busAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            status: BusAssignmentStatus.ENDED,
            endedAt: new Date(),
            endReason: BusAssignmentEndReason.TERMINATION,
            note: body.justification,
          },
        });
        await tx.busAssignmentEvent.create({
          data: {
            enrollmentId: enrollment.id,
            busAssignmentId: ended.id,
            fromBusId: activeAssignment.busId,
            eventType: BusAssignmentEventType.TERMINATION_RELEASED,
            note: body.justification,
          },
        });
        affectedAssignmentId = ended.id;
        affectedBusId = activeAssignment.busId;
      }

      await tx.student.update({
        where: { id },
        data: { status: StudentStatus.TERMINATED },
      });

      await this.endActiveBoardMembershipForTermination(tx, id, userId);
      await this.invalidateActiveStudentCardsForTermination(
        tx,
        id,
        userId,
        body.justification,
      );

      await tx.studentHistoryEvent.create({
        data: {
          studentId: id,
          eventType: StudentHistoryEventType.STUDENT_TERMINATED,
          terminationReason: body.terminationReason,
          justification: body.justification,
          busSeatReleased: true,
          busId: affectedBusId,
          busAssignmentId: affectedAssignmentId,
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.STUDENT_TERMINATED,
        domain: "students",
        recordId: id,
        userId,
        metadata: {
          studentId: id,
          enrollmentId: enrollment?.id ?? "",
          busAssignmentId: affectedAssignmentId ?? "",
          busId: affectedBusId ?? "",
          terminationReason: body.terminationReason,
        },
      });
    });

    await result;
    return this.getStudent(id);
  }

  async listStudentHistory(id: string) {
    await this.ensureStudent(id);
    const data = await this.prisma.studentHistoryEvent.findMany({
      where: { studentId: id },
      include: {
        bus: true,
        busAssignment: { include: { bus: true } },
        boardMembership: true,
      },
      orderBy: { occurredAt: "desc" },
    });
    return { data };
  }

  async listBoardMemberships(id: string) {
    await this.ensureStudent(id);
    const data = await this.prisma.boardMembership.findMany({
      where: { studentId: id },
      orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    });
    return { data };
  }

  async startBoardMembership(
    id: string,
    body: StartBoardMembershipDto,
    userId: string,
  ) {
    const membership = await this.prisma.$transaction(async (tx) => {
      const student = await this.lockStudent(tx, id);
      if (student.status !== StudentStatus.ACTIVE) {
        throw new BadRequestException("Somente academico ativo pode entrar na diretoria");
      }
      const active = await tx.boardMembership.findFirst({
        where: { studentId: id, status: BoardMembershipStatus.ACTIVE },
      });
      if (active) {
        throw new ConflictException("Academico ja possui diretoria ativa");
      }

      const created = await tx.boardMembership.create({
        data: {
          studentId: id,
          startedByUserId: userId,
          startNote: this.optional(body.note),
        },
      });
      await tx.studentHistoryEvent.create({
        data: {
          studentId: id,
          eventType: StudentHistoryEventType.BOARD_MEMBERSHIP_STARTED,
          boardMembershipId: created.id,
          justification: this.optional(body.note),
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BOARD_MEMBERSHIP_STARTED,
        domain: "board_memberships",
        recordId: created.id,
        userId,
        metadata: {
          studentId: id,
          boardMembershipId: created.id,
          action: "started",
        },
      });
      return created;
    });
    return membership;
  }

  async endBoardMembership(
    studentId: string,
    membershipId: string,
    body: EndBoardMembershipDto,
    userId: string,
  ) {
    const membership = await this.prisma.$transaction(async (tx) => {
      await this.lockStudent(tx, studentId);
      const active = await tx.boardMembership.findFirst({
        where: {
          id: membershipId,
          studentId,
          status: BoardMembershipStatus.ACTIVE,
        },
      });
      if (!active) {
        throw new BadRequestException("Diretoria ativa nao encontrada");
      }

      const ended = await tx.boardMembership.update({
        where: { id: active.id },
        data: {
          status: BoardMembershipStatus.ENDED,
          endedAt: new Date(),
          endedByUserId: userId,
          endNote: this.optional(body.note),
        },
      });
      await this.invalidateBoardMemberCardsForMembership(
        tx,
        studentId,
        ended.id,
        userId,
        this.optional(body.note),
      );
      await tx.studentHistoryEvent.create({
        data: {
          studentId,
          eventType: StudentHistoryEventType.BOARD_MEMBERSHIP_ENDED,
          boardMembershipId: ended.id,
          justification: this.optional(body.note),
          performedByUserId: userId,
        },
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.BOARD_MEMBERSHIP_ENDED,
        domain: "board_memberships",
        recordId: ended.id,
        userId,
        metadata: {
          studentId,
          boardMembershipId: ended.id,
          action: "ended",
        },
      });
      return ended;
    });
    return membership;
  }

  assertCanWriteAcademicYear(user: AuthUser) {
    if (!user.roles.includes(RoleCode.SUPER_ADMIN)) {
      throw new BadRequestException("Somente Super Admin altera Ano Letivo");
    }
  }

  private buildStudentWhere(query: ListStudentsDto): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};
    if (query.status !== StudentStatusFilter.ALL) {
      where.status =
        query.status === StudentStatusFilter.SUSPENDED
          ? StudentStatus.SUSPENDED
          : query.status === StudentStatusFilter.TERMINATED
            ? StudentStatus.TERMINATED
            : StudentStatus.ACTIVE;
    }

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

  private resolvePagination(query: ListStudentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
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

  private async resolveTargetAcademicYear(
    academicYearId?: string,
    tx: PrismaTx = this.prisma,
  ) {
    if (academicYearId) {
      return this.ensureAcademicYear(academicYearId, tx);
    }

    const record = await tx.academicYear.findFirst({
      where: { isCurrent: true },
    });
    if (!record) {
      throw new BadRequestException("Ano Letivo atual nao configurado");
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

  private async lockStudent(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM students WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("Academico nao encontrado");
    }
    const student = await tx.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundException("Academico nao encontrado");
    }
    return student;
  }

  private async findOperationalEnrollment(
    tx: Prisma.TransactionClient,
    studentId: string,
  ) {
    return tx.enrollment.findFirst({
      where: { studentId },
      orderBy: [{ academicYear: { year: "desc" } }, { createdAt: "desc" }],
    });
  }

  private findActiveBusAssignment(
    tx: Prisma.TransactionClient,
    enrollmentId: string,
  ) {
    return tx.busAssignment.findFirst({
      where: { enrollmentId, status: BusAssignmentStatus.ACTIVE },
    });
  }

  private async lockBus(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM buses WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("Onibus nao encontrado");
    }
  }

  private async ensureActiveBus(tx: Prisma.TransactionClient, id: string) {
    const bus = await tx.bus.findUnique({ where: { id } });
    if (!bus || bus.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Onibus ativo obrigatorio");
    }
    return bus;
  }

  private async ensureBusHasSeat(
    tx: Prisma.TransactionClient,
    busId: string,
    academicYearId: string,
  ) {
    const bus = await tx.bus.findUnique({ where: { id: busId } });
    if (!bus || bus.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Onibus ativo obrigatorio");
    }
    const occupiedSeats = await tx.busAssignment.count({
      where: {
        busId,
        status: BusAssignmentStatus.ACTIVE,
        enrollment: { academicYearId },
      },
    });
    if (occupiedSeats >= bus.capacity) {
      throw new ConflictException("Onibus lotado");
    }
  }

  private async endActiveBoardMembershipForTermination(
    tx: Prisma.TransactionClient,
    studentId: string,
    userId: string,
  ) {
    const active = await tx.boardMembership.findFirst({
      where: { studentId, status: BoardMembershipStatus.ACTIVE },
    });
    if (!active) {
      return;
    }

    const ended = await tx.boardMembership.update({
      where: { id: active.id },
      data: {
        status: BoardMembershipStatus.ENDED,
        endedAt: new Date(),
        endedByUserId: userId,
        endNote: "Encerrado automaticamente pelo desligamento do academico",
      },
    });
    await tx.studentHistoryEvent.create({
      data: {
        studentId,
        eventType: StudentHistoryEventType.BOARD_MEMBERSHIP_ENDED,
        boardMembershipId: ended.id,
        justification: ended.endNote,
        performedByUserId: userId,
      },
    });
    await this.recordAuditTx(tx, {
      eventType: AdministrativeAuditEventType.BOARD_MEMBERSHIP_ENDED,
      domain: "board_memberships",
      recordId: ended.id,
      userId,
      metadata: {
        studentId,
        boardMembershipId: ended.id,
        action: "ended_by_termination",
      },
    });
  }

  private async invalidateBoardMemberCardsForMembership(
    tx: Prisma.TransactionClient,
    studentId: string,
    boardMembershipId: string,
    userId: string,
    note?: string,
  ) {
    const cards = await tx.studentCard.findMany({
      where: {
        studentId,
        boardMembershipId,
        cardType: StudentCardType.BOARD_MEMBER,
        status: StudentCardStatus.ACTIVE,
      },
    });

    for (const card of cards) {
      await this.invalidateStudentCardTx(tx, {
        card,
        userId,
        reason: StudentCardInvalidationReason.BOARD_MEMBERSHIP_ENDED,
        note: note ?? "Invalidada pelo encerramento da diretoria",
      });
    }
  }

  private async invalidateActiveStudentCardsForTermination(
    tx: Prisma.TransactionClient,
    studentId: string,
    userId: string,
    note?: string,
  ) {
    const cards = await tx.studentCard.findMany({
      where: { studentId, status: StudentCardStatus.ACTIVE },
    });

    for (const card of cards) {
      await this.invalidateStudentCardTx(tx, {
        card,
        userId,
        reason: StudentCardInvalidationReason.STUDENT_TERMINATED,
        note: note ?? "Invalidada pelo desligamento do academico",
      });
    }
  }

  private async invalidateStudentCardTx(
    tx: Prisma.TransactionClient,
    input: {
      card: {
        id: string;
        studentId: string;
        enrollmentId: string;
        academicYearId: string;
        boardMembershipId: string | null;
        cardType: StudentCardType;
        sequenceNumber: number;
        cardNumber: string;
      };
      userId: string;
      reason: StudentCardInvalidationReason;
      note?: string;
    },
  ) {
    await tx.studentCard.update({
      where: { id: input.card.id },
      data: {
        status: StudentCardStatus.INVALIDATED,
        invalidatedAt: new Date(),
        invalidationReason: input.reason,
        invalidationNote: input.note,
        invalidatedByUserId: input.userId,
      },
    });
    await tx.studentHistoryEvent.create({
      data: {
        studentId: input.card.studentId,
        eventType: StudentHistoryEventType.STUDENT_CARD_INVALIDATED,
        studentCardId: input.card.id,
        boardMembershipId: input.card.boardMembershipId,
        justification: input.note,
        performedByUserId: input.userId,
      },
    });
    await this.recordAuditTx(tx, {
      eventType: AdministrativeAuditEventType.STUDENT_CARD_INVALIDATED,
      domain: "student_cards",
      recordId: input.card.id,
      userId: input.userId,
      metadata: {
        studentId: input.card.studentId,
        enrollmentId: input.card.enrollmentId,
        academicYearId: input.card.academicYearId,
        studentCardId: input.card.id,
        cardType: input.card.cardType,
        sequenceNumber: input.card.sequenceNumber,
        cardNumber: input.card.cardNumber,
        reason: input.reason,
      },
    });
  }

  private studentSummaryInclude() {
    return {
      person: true,
      boardMemberships: {
        where: { status: BoardMembershipStatus.ACTIVE },
        take: 1,
      },
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
      boardMemberships: {
        where: { status: BoardMembershipStatus.ACTIVE },
        take: 1,
      },
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
      canReceiveFutureInvoices: canReceiveFutureInvoices(student),
      activeBoardMembership: student.boardMemberships[0] ?? null,
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
      canReceiveFutureInvoices: canReceiveFutureInvoices(student),
      activeBoardMembership: student.boardMemberships[0] ?? null,
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

  private async recordAuditTx(
    tx: Prisma.TransactionClient,
    input: {
      eventType: AdministrativeAuditEventType;
      domain: string;
      recordId: string;
      userId: string;
      metadata: Record<string, string | number | boolean>;
    },
  ) {
    await tx.administrativeAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        domain: input.domain,
        recordId: input.recordId,
        metadata: input.metadata,
      },
    });
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
