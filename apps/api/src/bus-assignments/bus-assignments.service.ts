import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  BusAssignmentEndReason,
  BusAssignmentEventType,
  BusAssignmentStatus,
  Prisma,
  RecordStatus,
} from "@prisma/client";
import { maskCpf, normalizeCpf } from "../students/cpf.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  AssignmentStatusFilter,
  ListBusAssignmentsDto,
} from "./dto/bus-assignments.dto.js";
import { assertBusHasAvailableSeat, deriveBusAvailability } from "./capacity.js";

@Injectable()
export class BusAssignmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrentAssignment(enrollmentId: string) {
    await this.ensureEnrollment(enrollmentId);
    const assignment = await this.prisma.busAssignment.findFirst({
      where: { enrollmentId, status: BusAssignmentStatus.ACTIVE },
      include: this.assignmentInclude(),
    });

    return assignment ? this.toAssignment(assignment) : null;
  }

  async assignBus(enrollmentId: string, busId: string, userId: string, note?: string) {
    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const enrollment = await this.ensureEnrollment(enrollmentId, tx);
        const existing = await this.findActiveAssignment(tx, enrollmentId);
        if (existing) {
          throw new ConflictException("Matricula ja possui onibus ativo");
        }

        await this.lockBus(tx, busId);
        const bus = await this.ensureActiveBus(tx, busId);
        await this.ensureBusHasSeat(tx, bus.id, enrollment.academicYearId);

        const created = await tx.busAssignment.create({
          data: { enrollmentId, busId: bus.id, note: this.optional(note) },
          include: this.assignmentInclude(),
        });
        await tx.busAssignmentEvent.create({
          data: {
            enrollmentId,
            busAssignmentId: created.id,
            toBusId: bus.id,
            eventType: BusAssignmentEventType.LINKED,
            note: this.optional(note),
          },
        });
        await this.recordAudit(tx, {
          eventType: AdministrativeAuditEventType.BUS_ASSIGNMENT_LINKED,
          userId,
          domain: "bus_assignments",
          recordId: created.id,
          metadata: {
            enrollmentId,
            busAssignmentId: created.id,
            busId: bus.id,
            academicYearId: enrollment.academicYearId,
          },
        });
        return created;
      });
      return this.toAssignment(assignment);
    } catch (error) {
      this.handleUniqueAssignmentError(error);
    }
  }

  async releaseBus(enrollmentId: string, userId: string, note?: string) {
    const assignment = await this.prisma.$transaction(async (tx) => {
      const enrollment = await this.ensureEnrollment(enrollmentId, tx);
      const active = await this.findActiveAssignment(tx, enrollmentId);
      if (!active) {
        throw new BadRequestException("Matricula nao possui onibus ativo");
      }

      await this.lockBus(tx, active.busId);
      const ended = await tx.busAssignment.update({
        where: { id: active.id },
        data: {
          status: BusAssignmentStatus.ENDED,
          endedAt: new Date(),
          endReason: BusAssignmentEndReason.RELEASED,
          note: this.optional(note) ?? active.note,
        },
        include: this.assignmentInclude(),
      });
      await tx.busAssignmentEvent.create({
        data: {
          enrollmentId,
          busAssignmentId: ended.id,
          fromBusId: active.busId,
          eventType: BusAssignmentEventType.RELEASED,
          note: this.optional(note),
        },
      });
      await this.recordAudit(tx, {
        eventType: AdministrativeAuditEventType.BUS_ASSIGNMENT_RELEASED,
        userId,
        domain: "bus_assignments",
        recordId: ended.id,
        metadata: {
          enrollmentId,
          busAssignmentId: ended.id,
          busId: active.busId,
          academicYearId: enrollment.academicYearId,
          endReason: BusAssignmentEndReason.RELEASED,
        },
      });
      return ended;
    });

    return this.toAssignment(assignment);
  }

  async switchBus(
    enrollmentId: string,
    newBusId: string,
    userId: string,
    note?: string,
  ) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const enrollment = await this.ensureEnrollment(enrollmentId, tx);
        const active = await this.findActiveAssignment(tx, enrollmentId);
        if (!active) {
          throw new BadRequestException("Matricula nao possui onibus ativo");
        }
        if (active.busId === newBusId) {
          throw new BadRequestException("Novo onibus deve ser diferente do atual");
        }

        await this.lockBusesInOrder(tx, [active.busId, newBusId]);
        const newBus = await this.ensureActiveBus(tx, newBusId);
        await this.ensureBusHasSeat(tx, newBus.id, enrollment.academicYearId);

        await tx.busAssignment.update({
          where: { id: active.id },
          data: {
            status: BusAssignmentStatus.ENDED,
            endedAt: new Date(),
            endReason: BusAssignmentEndReason.SWITCHED,
            note: this.optional(note) ?? active.note,
          },
        });
        const created = await tx.busAssignment.create({
          data: { enrollmentId, busId: newBus.id, note: this.optional(note) },
          include: this.assignmentInclude(),
        });
        await tx.busAssignmentEvent.create({
          data: {
            enrollmentId,
            busAssignmentId: created.id,
            fromBusId: active.busId,
            toBusId: newBus.id,
            eventType: BusAssignmentEventType.SWITCHED,
            note: this.optional(note),
          },
        });
        await this.recordAudit(tx, {
          eventType: AdministrativeAuditEventType.BUS_ASSIGNMENT_SWITCHED,
          userId,
          domain: "bus_assignments",
          recordId: created.id,
          metadata: {
            enrollmentId,
            previousBusAssignmentId: active.id,
            busAssignmentId: created.id,
            fromBusId: active.busId,
            toBusId: newBus.id,
            academicYearId: enrollment.academicYearId,
            endReason: BusAssignmentEndReason.SWITCHED,
          },
        });
        return created;
      });
      return this.toAssignment(result);
    } catch (error) {
      this.handleUniqueAssignmentError(error);
    }
  }

  async listBusAssignments(busId: string, query: ListBusAssignmentsDto) {
    await this.ensureBus(busId);
    const academicYearId = await this.resolveAcademicYearId(query.academicYearId);
    const enrollmentWhere: Prisma.EnrollmentWhereInput = {};
    if (academicYearId) {
      enrollmentWhere.academicYearId = academicYearId;
    }

    const where: Prisma.BusAssignmentWhereInput = {
      busId,
      ...(query.status === AssignmentStatusFilter.ACTIVE
        ? { status: BusAssignmentStatus.ACTIVE }
        : {}),
      ...(Object.keys(enrollmentWhere).length > 0
        ? { enrollment: enrollmentWhere }
        : {}),
    };

    if (query.search) {
      const normalizedSearch = this.normalizeName(query.search);
      const cpfSearch = normalizeCpf(query.search);
      where.enrollment = {
        ...enrollmentWhere,
        student: {
          person: {
            OR: [
              { normalizedName: { contains: normalizedSearch } },
              ...(cpfSearch ? [{ cpf: { contains: cpfSearch } }] : []),
            ],
          },
        },
      };
    }

    const skip = (query.page - 1) * query.limit;
    const [data, total, occupancy] = await Promise.all([
      this.prisma.busAssignment.findMany({
        where,
        include: this.assignmentInclude(),
        orderBy: [
          { enrollment: { student: { person: { normalizedName: "asc" } } } },
          { startedAt: "desc" },
        ],
        skip,
        take: query.limit,
      }),
      this.prisma.busAssignment.count({ where }),
      this.getBusOccupancy(busId, academicYearId),
    ]);

    return {
      data: data.map((assignment) => this.toAssignment(assignment)),
      occupancy,
      academicYearId,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async listEnrollmentEvents(enrollmentId: string) {
    await this.ensureEnrollment(enrollmentId);
    const data = await this.prisma.busAssignmentEvent.findMany({
      where: { enrollmentId },
      include: {
        fromBus: true,
        toBus: true,
      },
      orderBy: { occurredAt: "desc" },
    });

    return { data };
  }

  private async getBusOccupancy(busId: string, academicYearId: string | null) {
    const bus = await this.ensureBus(busId);
    const occupiedSeats = await this.prisma.busAssignment.count({
      where: {
        busId,
        status: BusAssignmentStatus.ACTIVE,
        ...(academicYearId ? { enrollment: { academicYearId } } : {}),
      },
    });

    return {
      busId,
      ...deriveBusAvailability(bus.capacity, occupiedSeats),
    };
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
    assertBusHasAvailableSeat(bus.capacity, occupiedSeats);
  }

  private async ensureActiveBus(tx: Prisma.TransactionClient, id: string) {
    const bus = await tx.bus.findUnique({ where: { id } });
    if (!bus || bus.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException("Onibus ativo obrigatorio");
    }
    return bus;
  }

  private async ensureBus(id: string) {
    const bus = await this.prisma.bus.findUnique({ where: { id } });
    if (!bus) {
      throw new NotFoundException("Onibus nao encontrado");
    }
    return bus;
  }

  private async ensureEnrollment(
    id: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const enrollment = await tx.enrollment.findUnique({
      where: { id },
      include: {
        academicYear: true,
        student: { include: { person: true } },
      },
    });
    if (!enrollment) {
      throw new NotFoundException("Matricula nao encontrada");
    }
    return enrollment;
  }

  private findActiveAssignment(tx: Prisma.TransactionClient, enrollmentId: string) {
    return tx.busAssignment.findFirst({
      where: { enrollmentId, status: BusAssignmentStatus.ACTIVE },
    });
  }

  private async resolveAcademicYearId(academicYearId?: string) {
    if (academicYearId) {
      return academicYearId;
    }
    const current = await this.prisma.academicYear.findFirst({
      where: { isCurrent: true },
      select: { id: true },
    });
    return current?.id ?? null;
  }

  private async lockBus(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM buses WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException("Onibus nao encontrado");
    }
  }

  private async lockBusesInOrder(tx: Prisma.TransactionClient, ids: string[]) {
    const uniqueIds = [...new Set(ids)].sort();
    for (const id of uniqueIds) {
      await this.lockBus(tx, id);
    }
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    input: {
      eventType: AdministrativeAuditEventType;
      userId: string;
      domain: string;
      recordId: string;
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

  private assignmentInclude() {
    return {
      bus: true,
      enrollment: {
        include: {
          academicYear: true,
          institution: true,
          shift: true,
          student: { include: { person: true } },
        },
      },
    } satisfies Prisma.BusAssignmentInclude;
  }

  private toAssignment(assignment: AssignmentWithRelations) {
    const person = assignment.enrollment.student.person;
    return {
      id: assignment.id,
      status: assignment.status,
      startedAt: assignment.startedAt,
      endedAt: assignment.endedAt,
      endReason: assignment.endReason,
      note: assignment.note,
      bus: assignment.bus,
      enrollment: {
        id: assignment.enrollment.id,
        status: assignment.enrollment.status,
        course: assignment.enrollment.course,
        grade: assignment.enrollment.grade,
        academicYear: assignment.enrollment.academicYear,
        institution: assignment.enrollment.institution,
        shift: assignment.enrollment.shift,
      },
      student: {
        id: assignment.enrollment.student.id,
        fullName: person.fullName,
        cpfMasked: maskCpf(person.cpf),
      },
    };
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

  private handleUniqueAssignmentError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Matricula ja possui onibus ativo");
    }
    throw error;
  }
}

type AssignmentWithRelations = Prisma.BusAssignmentGetPayload<{
  include: ReturnType<BusAssignmentsService["assignmentInclude"]>;
}>;
