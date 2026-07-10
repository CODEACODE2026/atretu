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
} from "@prisma/client";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  BaseRecordSort,
  ListBaseRecordsDto,
  RecordStatusFilter,
  SortOrder,
} from "./dto/base-record.dto.js";

type Domain = "institutions" | "shifts" | "buses";
type WritableData = { name?: string; capacity?: number };
type ListResult<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const DOMAIN_LABELS: Record<Domain, string> = {
  institutions: "instituicao",
  shifts: "turno",
  buses: "onibus",
};

@Injectable()
export class BaseRecordsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  listInstitutions(query: ListBaseRecordsDto) {
    return this.list(this.prisma.institution, "institutions", query);
  }

  createInstitution(data: { name: string }, userId: string) {
    return this.create(this.prisma.institution, "institutions", data, userId);
  }

  getInstitution(id: string) {
    return this.get(this.prisma.institution, "institutions", id);
  }

  updateInstitution(id: string, data: { name?: string }, userId: string) {
    return this.update(this.prisma.institution, "institutions", id, data, userId);
  }

  inactivateInstitution(id: string, userId: string) {
    return this.setStatus(
      this.prisma.institution,
      "institutions",
      id,
      RecordStatus.INACTIVE,
      userId,
    );
  }

  reactivateInstitution(id: string, userId: string) {
    return this.setStatus(
      this.prisma.institution,
      "institutions",
      id,
      RecordStatus.ACTIVE,
      userId,
    );
  }

  listShifts(query: ListBaseRecordsDto) {
    return this.list(this.prisma.shift, "shifts", query);
  }

  createShift(data: { name: string }, userId: string) {
    return this.create(this.prisma.shift, "shifts", data, userId);
  }

  getShift(id: string) {
    return this.get(this.prisma.shift, "shifts", id);
  }

  updateShift(id: string, data: { name?: string }, userId: string) {
    return this.update(this.prisma.shift, "shifts", id, data, userId);
  }

  inactivateShift(id: string, userId: string) {
    return this.setStatus(
      this.prisma.shift,
      "shifts",
      id,
      RecordStatus.INACTIVE,
      userId,
    );
  }

  reactivateShift(id: string, userId: string) {
    return this.setStatus(
      this.prisma.shift,
      "shifts",
      id,
      RecordStatus.ACTIVE,
      userId,
    );
  }

  listBuses(query: ListBaseRecordsDto) {
    return this.list(this.prisma.bus, "buses", query);
  }

  createBus(data: { name: string; capacity: number }, userId: string) {
    return this.create(this.prisma.bus, "buses", data, userId);
  }

  getBus(id: string) {
    return this.get(this.prisma.bus, "buses", id);
  }

  updateBus(id: string, data: { name?: string; capacity?: number }, userId: string) {
    return this.update(this.prisma.bus, "buses", id, data, userId);
  }

  inactivateBus(id: string, userId: string) {
    return this.setStatus(
      this.prisma.bus,
      "buses",
      id,
      RecordStatus.INACTIVE,
      userId,
    );
  }

  reactivateBus(id: string, userId: string) {
    return this.setStatus(
      this.prisma.bus,
      "buses",
      id,
      RecordStatus.ACTIVE,
      userId,
    );
  }

  private async list<T extends { id: string }>(
    delegate: RecordDelegate<T>,
    domain: Domain,
    query: ListBaseRecordsDto,
  ): Promise<ListResult<T>> {
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      delegate.findMany({ where, orderBy, skip, take: query.limit }),
      delegate.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private async create<T extends { id: string }>(
    delegate: RecordDelegate<T>,
    domain: Domain,
    data: { name: string; capacity?: number },
    userId: string,
  ): Promise<T> {
    try {
      const record = await delegate.create({
        data: {
          ...data,
          normalizedName: this.normalizeName(data.name),
        },
      });
      await this.recordAudit(
        AdministrativeAuditEventType.BASE_RECORD_CREATED,
        domain,
        record.id,
        userId,
      );
      return record;
    } catch (error) {
      this.handleWriteError(error, domain);
    }
  }

  private async get<T extends { id: string }>(
    delegate: RecordDelegate<T>,
    domain: Domain,
    id: string,
  ): Promise<T> {
    const record = await delegate.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`${DOMAIN_LABELS[domain]} nao encontrado`);
    }
    return record;
  }

  private async update<T extends { id: string; name: string }>(
    delegate: RecordDelegate<T>,
    domain: Domain,
    id: string,
    data: WritableData,
    userId: string,
  ): Promise<T> {
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Informe ao menos um campo para atualizar");
    }

    await this.get(delegate, domain, id);

    const updateData: WritableData & { normalizedName?: string } = { ...data };
    if (data.name) {
      updateData.normalizedName = this.normalizeName(data.name);
    }

    try {
      const record = await delegate.update({ where: { id }, data: updateData });
      await this.recordAudit(
        AdministrativeAuditEventType.BASE_RECORD_UPDATED,
        domain,
        record.id,
        userId,
      );
      return record;
    } catch (error) {
      this.handleWriteError(error, domain);
    }
  }

  private async setStatus<T extends { id: string; status: RecordStatus }>(
    delegate: RecordDelegate<T>,
    domain: Domain,
    id: string,
    status: RecordStatus,
    userId: string,
  ): Promise<T> {
    const current = await this.get(delegate, domain, id);
    if (current.status === status) {
      return current;
    }

    const record = await delegate.update({ where: { id }, data: { status } });
    await this.recordAudit(
      status === RecordStatus.ACTIVE
        ? AdministrativeAuditEventType.BASE_RECORD_REACTIVATED
        : AdministrativeAuditEventType.BASE_RECORD_INACTIVATED,
      domain,
      record.id,
      userId,
    );
    return record;
  }

  private buildWhere(query: ListBaseRecordsDto): Prisma.JsonObject {
    const where: Prisma.JsonObject = {};
    if (query.status !== RecordStatusFilter.ALL) {
      where.status =
        query.status === RecordStatusFilter.ACTIVE
          ? RecordStatus.ACTIVE
          : RecordStatus.INACTIVE;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }

    return where;
  }

  private buildOrderBy(query: ListBaseRecordsDto): Prisma.JsonObject[] {
    const direction = query.order === SortOrder.DESC ? "desc" : "asc";
    const primary =
      query.sort === BaseRecordSort.CREATED_AT
        ? "createdAt"
        : query.sort === BaseRecordSort.UPDATED_AT
          ? "updatedAt"
          : query.sort === BaseRecordSort.STATUS
            ? "status"
            : "name";

    return [{ [primary]: direction }, { name: "asc" }];
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  private async recordAudit(
    eventType: AdministrativeAuditEventType,
    domain: Domain,
    recordId: string,
    userId: string,
  ): Promise<void> {
    await this.audit.record({
      eventType,
      userId,
      domain,
      recordId,
      metadata: { domain, recordId },
    });
  }

  private handleWriteError(error: unknown, domain: Domain): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(`${DOMAIN_LABELS[domain]} ja cadastrado`);
    }

    throw error;
  }
}

type RecordDelegate<T> = {
  findMany(args: {
    where: Prisma.JsonObject;
    orderBy: Prisma.JsonObject[];
    skip: number;
    take: number;
  }): Promise<T[]>;
  count(args: { where: Prisma.JsonObject }): Promise<number>;
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  create(args: { data: Prisma.JsonObject }): Promise<T>;
  update(args: {
    where: { id: string };
    data: Prisma.JsonObject | WritableData;
  }): Promise<T>;
};
