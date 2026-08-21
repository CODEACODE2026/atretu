import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AdministrativeAuditEventType, Prisma } from "@prisma/client";
import { AdministrativeAuditService } from "../administrative-audit/administrative-audit.service.js";
import {
  DELEGATABLE_PERMISSION_CATALOG,
  isDelegatablePermissionKey,
  PERMISSION_DEPENDENCIES,
  type PermissionKey,
} from "../auth/permission-catalog.js";
import { resolvePagination } from "../common/pagination.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  CreatePermissionProfileDto,
  ListPermissionProfilesDto,
  PermissionProfileSort,
  PermissionProfileStatusFilter,
  SortOrder,
  UpdatePermissionProfileDto,
} from "./dto/permission-profiles.dto.js";
import type { AuthUser } from "../users/users.service.js";

type PermissionProfileWithPermissions = Prisma.PermissionProfileGetPayload<{
  include: {
    _count: { select: { users: true } };
    permissions: { select: { permissionKey: true } };
  };
}>;

@Injectable()
export class PermissionProfilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
  ) {}

  catalog() {
    return DELEGATABLE_PERMISSION_CATALOG;
  }

  async list(query: ListPermissionProfilesDto) {
    const pagination = resolvePagination(query);
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);
    const [data, total] = await Promise.all([
      this.prisma.permissionProfile.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
        include: this.include(),
      }),
      this.prisma.permissionProfile.count({ where }),
    ]);

    return {
      data: data.map((profile) => this.toResponse(profile)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(Math.ceil(total / pagination.limit), 1),
      },
    };
  }

  async listActiveOptions() {
    return this.prisma.permissionProfile.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async get(id: string) {
    const profile = await this.findOrThrow(id);
    return this.toResponse(profile);
  }

  async create(input: CreatePermissionProfileDto, currentUser: AuthUser) {
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    const permissions = this.normalizePermissions(input.permissions);
    await this.assertUniqueName(name);

    const created = await this.prisma.permissionProfile.create({
      data: {
        name,
        description,
        isActive: input.isActive,
        permissions: {
          create: permissions.map((permissionKey) => ({ permissionKey })),
        },
      },
      include: this.include(),
    });
    await this.recordAudit({
      eventType: AdministrativeAuditEventType.BASE_RECORD_CREATED,
      profile: created,
      userId: currentUser.id,
      metadata: {
        action: "permission_profile_created",
        after: this.auditValues(created),
      },
    });
    return this.toResponse(created);
  }

  async update(id: string, input: UpdatePermissionProfileDto, currentUser: AuthUser) {
    const current = await this.findOrThrow(id);
    const name = input.name?.trim();
    if (name) {
      await this.assertUniqueName(name, id);
    }
    const permissions = input.permissions
      ? this.normalizePermissions(input.permissions)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (permissions) {
        await tx.permissionProfilePermission.deleteMany({
          where: { profileId: id },
        });
      }
      return tx.permissionProfile.update({
        where: { id },
        data: {
          description:
            input.description === undefined
              ? undefined
              : input.description?.trim() || null,
          isActive: input.isActive,
          name,
          permissions: permissions
            ? { create: permissions.map((permissionKey) => ({ permissionKey })) }
            : undefined,
        },
        include: this.include(),
      });
    });

    await this.recordAudit({
      eventType: this.auditEventType(current, updated),
      profile: updated,
      userId: currentUser.id,
      metadata: {
        action: this.auditAction(current, updated),
        after: this.auditValues(updated),
        before: this.auditValues(current),
        permissionsChanged: permissions
          ? !this.samePermissions(
              current.permissions.map((permission) => permission.permissionKey),
              updated.permissions.map((permission) => permission.permissionKey),
            )
          : false,
      },
    });
    return this.toResponse(updated);
  }

  setActive(id: string, isActive: boolean, currentUser: AuthUser) {
    return this.update(id, { isActive }, currentUser);
  }

  private include() {
    return {
      _count: { select: { users: true } },
      permissions: {
        orderBy: { permissionKey: "asc" },
        select: { permissionKey: true },
      },
    } satisfies Prisma.PermissionProfileInclude;
  }

  private buildWhere(query: ListPermissionProfilesDto) {
    const where: Prisma.PermissionProfileWhereInput = {};
    if (query.status === PermissionProfileStatusFilter.ACTIVE) {
      where.isActive = true;
    } else if (query.status === PermissionProfileStatusFilter.INACTIVE) {
      where.isActive = false;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: "insensitive" };
    }
    return where;
  }

  private buildOrderBy(query: ListPermissionProfilesDto) {
    const direction = query.order === SortOrder.DESC ? "desc" : "asc";
    if (query.sort === PermissionProfileSort.CREATED_AT) {
      return [{ createdAt: direction }, { name: "asc" }] satisfies
        Prisma.PermissionProfileOrderByWithRelationInput[];
    }
    if (query.sort === PermissionProfileSort.UPDATED_AT) {
      return [{ updatedAt: direction }, { name: "asc" }] satisfies
        Prisma.PermissionProfileOrderByWithRelationInput[];
    }
    return [{ name: direction }] satisfies
      Prisma.PermissionProfileOrderByWithRelationInput[];
  }

  private async findOrThrow(id: string): Promise<PermissionProfileWithPermissions> {
    const profile = await this.prisma.permissionProfile.findUnique({
      where: { id },
      include: this.include(),
    });
    if (!profile) {
      throw new NotFoundException("Perfil de permissoes nao encontrado");
    }
    return profile;
  }

  private async assertUniqueName(name: string, currentId?: string) {
    const existing = await this.prisma.permissionProfile.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(currentId ? { id: { not: currentId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("Ja existe um perfil de permissoes com este nome");
    }
  }

  private normalizePermissions(values: string[]): PermissionKey[] {
    const invalid = values.filter((value) => !isDelegatablePermissionKey(value));
    if (invalid.length > 0) {
      throw new BadRequestException("Permissao nao delegavel no perfil");
    }
    const expanded = new Set<PermissionKey>();
    for (const value of values as PermissionKey[]) {
      expanded.add(value);
      for (const dependency of PERMISSION_DEPENDENCIES[value] ?? []) {
        expanded.add(dependency);
      }
    }
    return Array.from(expanded).sort();
  }

  private auditEventType(
    before: PermissionProfileWithPermissions,
    after: PermissionProfileWithPermissions,
  ) {
    if (before.isActive && !after.isActive) {
      return AdministrativeAuditEventType.BASE_RECORD_INACTIVATED;
    }
    if (!before.isActive && after.isActive) {
      return AdministrativeAuditEventType.BASE_RECORD_REACTIVATED;
    }
    return AdministrativeAuditEventType.BASE_RECORD_UPDATED;
  }

  private auditAction(
    before: PermissionProfileWithPermissions,
    after: PermissionProfileWithPermissions,
  ) {
    if (before.isActive && !after.isActive) {
      return "permission_profile_inactivated";
    }
    if (!before.isActive && after.isActive) {
      return "permission_profile_reactivated";
    }
    return "permission_profile_updated";
  }

  private auditValues(profile: PermissionProfileWithPermissions) {
    return {
      description: profile.description,
      isActive: profile.isActive,
      name: profile.name,
      permissions: profile.permissions.map((permission) => permission.permissionKey),
      usersCount: profile._count.users,
    };
  }

  private async recordAudit(input: {
    eventType: AdministrativeAuditEventType;
    profile: PermissionProfileWithPermissions;
    userId: string;
    metadata: Prisma.InputJsonObject;
  }) {
    await this.audit.record({
      eventType: input.eventType,
      userId: input.userId,
      domain: "permission_profiles",
      recordId: input.profile.id,
      metadata: input.metadata,
    });
  }

  private samePermissions(left: string[], right: string[]) {
    if (left.length !== right.length) {
      return false;
    }
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.every((permission, index) => permission === sortedRight[index]);
  }

  private toResponse(profile: PermissionProfileWithPermissions) {
    return {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      isActive: profile.isActive,
      permissions: profile.permissions.map((permission) => permission.permissionKey),
      usersCount: profile._count.users,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
