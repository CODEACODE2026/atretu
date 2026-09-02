import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  Prisma,
  RoleCode,
  UserStatus,
  type User,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  AdministrativeAuditService,
  sanitizeAdministrativeAuditMetadata,
} from "../administrative-audit/administrative-audit.service.js";
import {
  operationalCapabilitiesForRoles,
  SPRINT_OPERATIONAL_PERMISSION_KEYS,
  type SprintOperationalPermissionKey,
} from "../auth/operational-permissions.js";
import { resolvePagination } from "../common/pagination.js";
import { AppConfigService } from "../config/app-config.service.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  AdminUserSort,
  SortOrder,
  type CreateAdminUserDto,
  type ListAdminUsersDto,
  type UpdateAdminUserDto,
} from "./dto/admin-users.dto.js";
import type { ChangePasswordDto, UpdateOwnAccountDto } from "./dto/account.dto.js";
import { assertPasswordPolicy } from "./password-policy.js";
import { generateTemporaryPassword } from "./temporary-password.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  mustChangePassword?: boolean;
  passwordChangedAt?: Date | null;
  permissionProfileId?: string | null;
  roles: RoleCode[];
  institutionId?: string | null;
  institutionIds?: string[];
};

export type AuthUserWithCapabilities = AuthUser & {
  capabilities: SprintOperationalPermissionKey[];
};

type UserWithAdminRelations = User & {
  permissionProfile: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
  roles: Array<{ role: { code: RoleCode } }>;
  institutions: Array<{
    institution: {
      id: string;
      name: string;
      status: string;
    };
    institutionId: string;
  }>;
};

type AdminUserResponse = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  status: UserStatus;
  permissionProfileId: string | null;
  permissionProfile: { id: string; name: string; isActive: boolean } | null;
  roles: RoleCode[];
  institutionIds: string[];
  institutions: Array<{ id: string; name: string; status: string }>;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  blockedAt: Date | null;
  effectivePermissions: {
    canAdminUsers: boolean;
    globalAccess: boolean;
    institutionScope: "global" | "restricted" | "none";
  };
};

type AccountUserResponse = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: RoleCode[];
  institutionIds: string[];
  mustChangePassword: boolean;
};

type PermissionProfileOption = {
  id: string;
  name: string;
  description: string | null;
};

type AuditContext = {
  ip?: string;
  userAgent?: string | string[];
};

type AdminActor = AuthUser;

const CREATE_ADMIN_ASSIGNABLE_ROLES = new Set<RoleCode>([
  RoleCode.ADMINISTRATOR,
  RoleCode.SUPER_ADMIN,
  RoleCode.USER,
]);
const TRANSITION_ASSIGNABLE_ROLE = RoleCode.SECRETARIA;
const MAX_AUDIT_USER_AGENT_LENGTH = 500;

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdministrativeAuditService)
    private readonly audit: AdministrativeAuditService,
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
  ) {}

  async findByEmailWithPassword(email: string): Promise<
    | (User & {
        roles: Array<{ role: { code: RoleCode } }>;
        institutions: Array<{ institutionId: string }>;
      })
    | null
  > {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        roles: { include: { role: true } },
        institutions: { select: { institutionId: true } },
      },
    });
  }

  async findByIdWithPassword(id: string): Promise<
    | (User & {
        roles: Array<{ role: { code: RoleCode } }>;
        institutions: Array<{ institutionId: string }>;
      })
    | null
  > {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        institutions: { select: { institutionId: true } },
      },
    });
  }

  async findAuthUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        institutions: { select: { institutionId: true } },
      },
    });

    if (!user) {
      return null;
    }

    return this.toAuthUser(user);
  }

  async withOperationalCapabilities(
    user: AuthUser,
  ): Promise<AuthUserWithCapabilities> {
    const roleCapabilities = operationalCapabilitiesForRoles(user.roles);
    if (roleCapabilities.length > 0) {
      return { ...user, capabilities: roleCapabilities };
    }

    if (!user.roles.includes(RoleCode.USER) || !user.permissionProfileId) {
      return { ...user, capabilities: [] };
    }

    const profile = await this.prisma.permissionProfile.findFirst({
      where: {
        id: user.permissionProfileId,
        isActive: true,
      },
      select: {
        permissions: {
          where: {
            permissionKey: { in: [...SPRINT_OPERATIONAL_PERMISSION_KEYS] },
          },
          select: { permissionKey: true },
        },
      },
    });

    return {
      ...user,
      capabilities:
        profile?.permissions.map(
          (permission) =>
            permission.permissionKey as SprintOperationalPermissionKey,
        ) ?? [],
    };
  }

  async countSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: {
        roles: {
          some: {
            role: {
              code: RoleCode.SUPER_ADMIN,
            },
          },
        },
      },
    });
  }

  async createUserWithRole(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: RoleCode;
  }): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Usuario ja cadastrado");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { code: input.role },
        update: {},
        create: {
          code: input.role,
          description:
            input.role === RoleCode.SUPER_ADMIN
              ? "Acesso completo ao sistema"
              : "Acesso operacional administrativo",
        },
      });

      return tx.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          roles: {
            create: {
              roleId: role.id,
            },
          },
        },
        include: {
          roles: { include: { role: true } },
          institutions: { select: { institutionId: true } },
        },
      });
    });

    return this.toAuthUser(user);
  }

  async markLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async listAdminUsers(query: ListAdminUsersDto, actor?: AdminActor) {
    const pagination = resolvePagination(query);
    const where = this.buildAdminUserWhere(query, actor);
    const orderBy = this.adminUserOrderBy(query.sort, query.order);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
        include: this.adminUserInclude(),
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((user) => this.toAdminUser(user)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(Math.ceil(total / pagination.limit), 1),
      },
    };
  }

  async getAdminUser(
    id: string,
    actor?: AdminActor,
  ): Promise<AdminUserResponse> {
    const user = await this.findAdminUserOrThrow(id);
    if (actor) {
      this.assertActorCanViewCurrentUser(actor, this.roleCodes(user));
    }
    return this.toAdminUser(user);
  }

  async listActivePermissionProfiles(): Promise<PermissionProfileOption[]> {
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

  async createAdminUser(
    input: CreateAdminUserDto,
    actor: AdminActor,
    context: AuditContext = {},
  ) {
    const actorUserId = this.actorUserId(actor);
    this.assertActorCanCreateUser(actor, input.role);
    const email = input.email.trim().toLowerCase();
    const institutionIds = this.uniqueIds(input.institutionIds ?? []);
    this.assertUserInstitutionRequirement(input.role, institutionIds);
    const normalizedProfileId = await this.resolvePermissionProfileId(
      this.prisma,
      input.role,
      input.permissionProfileId,
    );
    const temporaryPassword = generateTemporaryPassword();
    const now = new Date();
    const passwordHash = await this.hashPassword(temporaryPassword);

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("Usuario ja cadastrado");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await this.assertInstitutionsExist(tx, institutionIds);
      const role = await tx.role.findUniqueOrThrow({
        where: { code: input.role },
        select: { id: true },
      });
      const created = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          phone: this.normalizePhone(input.phone),
          position: this.normalizeOptionalText(input.position),
          status: input.status ?? UserStatus.ACTIVE,
          permissionProfileId: normalizedProfileId,
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: now,
          roles: { create: { roleId: role.id } },
          institutions:
            institutionIds.length > 0
              ? {
                  createMany: {
                    data: institutionIds.map((institutionId) => ({
                      institutionId,
                    })),
                    skipDuplicates: true,
                  },
                }
              : undefined,
        },
        include: this.adminUserInclude(),
      });

      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.USER_CREATED,
        userId: actorUserId,
        recordId: created.id,
        metadata: {
          origin: "admin_users",
          actorUserId,
          targetUserId: created.id,
          email,
          phoneAfter: this.normalizePhone(input.phone),
          positionAfter: this.normalizeOptionalText(input.position),
          roleAfter: input.role,
          statusAfter: input.status ?? UserStatus.ACTIVE,
          permissionProfileIdAfter: normalizedProfileId,
          institutionIdsAfter: institutionIds,
          mustChangePasswordAfter: true,
          ...this.auditRequestMetadata(context),
        },
      });
      if (institutionIds.length > 0) {
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.USER_INSTITUTIONS_CHANGED,
          userId: actorUserId,
          recordId: created.id,
          metadata: {
            origin: "admin_users",
            actorUserId,
            targetUserId: created.id,
            institutionIdsBefore: [],
            institutionIdsAfter: institutionIds,
            ...this.auditRequestMetadata(context),
          },
        });
      }
      return created;
    });

    return {
      user: this.toAdminUser(user),
      temporaryPassword,
    };
  }

  async updateAdminUser(
    id: string,
    input: UpdateAdminUserDto,
    actor: AdminActor,
    context: AuditContext = {},
  ): Promise<AdminUserResponse> {
    const actorUserId = this.actorUserId(actor);
    const nextEmail = input.email?.trim().toLowerCase();

    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.findAdminUserOrThrowTx(tx, id);
        const currentRoles = this.roleCodes(current);
        this.assertActorCanManageCurrentUser(actor, id, currentRoles);
        if (input.role) {
          this.assertActorCanAssignRoleForUpdate(actor, input.role, currentRoles);
        }
        if (input.status && input.status !== current.status) {
          this.assertActorCanChangeCurrentUserStatus(actor, currentRoles);
        }
        const nextRoles = input.role ? [input.role] : currentRoles;
        const nextStatus = input.status ?? current.status;
        const currentInstitutionIds = this.institutionIds(current);
        const nextInstitutionIds =
          input.institutionIds === undefined
            ? currentInstitutionIds
            : this.uniqueIds(input.institutionIds);
        if (
          input.institutionIds !== undefined &&
          !this.sameIds(currentInstitutionIds, nextInstitutionIds)
        ) {
          this.assertActorCanChangeCurrentUserInstitutions(actor, currentRoles);
        }
        this.assertUserInstitutionRequirement(
          nextRoles[0]!,
          nextInstitutionIds,
        );
        const nextPermissionProfileId = await this.resolvePermissionProfileId(
          tx,
          nextRoles[0]!,
          input.permissionProfileId,
          current.permissionProfileId,
        );

        if (nextEmail && nextEmail !== current.email) {
          const existing = await tx.user.findUnique({
            where: { email: nextEmail },
            select: { id: true },
          });
          if (existing && existing.id !== id) {
            throw new ConflictException("Usuario ja cadastrado");
          }
        }

        if (actorUserId === id && input.role && input.role !== currentRoles[0]) {
          throw new ForbiddenException("Nao e permitido alterar o proprio perfil");
        }
        if (actorUserId === id && input.status && input.status !== current.status) {
          throw new ForbiddenException("Nao e permitido alterar o proprio status");
        }

        await this.assertActiveSuperAdminRemains(tx, id, {
          roles: nextRoles,
          status: nextStatus,
        });
        if (input.institutionIds !== undefined) {
          await this.assertInstitutionsExist(tx, nextInstitutionIds);
        }

        const updated = await tx.user.update({
          where: { id },
          data: {
            ...(input.name ? { name: input.name.trim() } : {}),
            ...(nextEmail ? { email: nextEmail } : {}),
            ...(input.phone !== undefined
              ? { phone: this.normalizePhone(input.phone) }
              : {}),
            ...(input.position !== undefined
              ? { position: this.normalizeOptionalText(input.position) }
              : {}),
            ...(input.status ? { status: input.status } : {}),
            permissionProfileId: nextPermissionProfileId,
          },
          include: this.adminUserInclude(),
        });

        if (input.role && input.role !== currentRoles[0]) {
          const role = await tx.role.findUniqueOrThrow({
            where: { code: input.role },
            select: { id: true },
          });
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userRole.create({
            data: {
              userId: id,
              roleId: role.id,
            },
          });
          await this.recordAuditTx(tx, {
            eventType: AdministrativeAuditEventType.USER_ROLE_CHANGED,
            userId: actorUserId,
            recordId: id,
            metadata: {
              origin: "admin_users",
              actorUserId,
              targetUserId: id,
              roleBefore: currentRoles[0] ?? null,
              roleAfter: input.role,
              permissionProfileIdBefore: current.permissionProfileId,
              permissionProfileIdAfter: nextPermissionProfileId,
              institutionIdsBefore: currentInstitutionIds,
              institutionIdsAfter: nextInstitutionIds,
              ...this.auditRequestMetadata(context),
            },
          });
        }

        if (
          input.institutionIds !== undefined &&
          !this.sameIds(currentInstitutionIds, nextInstitutionIds)
        ) {
          await tx.userInstitution.deleteMany({ where: { userId: id } });
          if (nextInstitutionIds.length > 0) {
            await tx.userInstitution.createMany({
              data: nextInstitutionIds.map((institutionId) => ({
                userId: id,
                institutionId,
              })),
              skipDuplicates: true,
            });
          }
          await this.recordAuditTx(tx, {
            eventType: AdministrativeAuditEventType.USER_INSTITUTIONS_CHANGED,
            userId: actorUserId,
            recordId: id,
            metadata: {
              origin: "admin_users",
              actorUserId,
              targetUserId: id,
              roleBefore: currentRoles[0] ?? null,
              roleAfter: nextRoles[0] ?? null,
              permissionProfileIdBefore: current.permissionProfileId,
              permissionProfileIdAfter: nextPermissionProfileId,
              institutionIdsBefore: currentInstitutionIds,
              institutionIdsAfter: nextInstitutionIds,
              ...this.auditRequestMetadata(context),
            },
          });
        }

        const changedFields = this.changedBasicUserFields(current, input);
        if (changedFields.length > 0) {
          await this.recordAuditTx(tx, {
            eventType: AdministrativeAuditEventType.USER_UPDATED,
            userId: actorUserId,
            recordId: id,
            metadata: {
              origin: "admin_users",
              actorUserId,
              targetUserId: id,
              changedFields,
              before: this.basicUserSnapshot(current, changedFields),
              after: this.basicUserSnapshot(
                {
                  ...current,
                  name: input.name?.trim() ?? current.name,
                  email: nextEmail ?? current.email,
                  phone:
                    input.phone !== undefined
                      ? this.normalizePhone(input.phone)
                      : current.phone,
                  position:
                    input.position !== undefined
                      ? this.normalizeOptionalText(input.position)
                      : current.position,
                },
                changedFields,
              ),
              ...this.auditRequestMetadata(context),
            },
          });
        }

        if (input.status && input.status !== current.status) {
          await this.recordAuditTx(tx, {
            eventType: AdministrativeAuditEventType.USER_STATUS_CHANGED,
            userId: actorUserId,
            recordId: id,
            metadata: {
              origin: "admin_users",
              actorUserId,
              targetUserId: id,
              statusBefore: current.status,
              statusAfter: input.status,
              ...this.auditRequestMetadata(context),
            },
          });
        }

        if (nextPermissionProfileId !== current.permissionProfileId) {
          await this.recordAuditTx(tx, {
            eventType: AdministrativeAuditEventType.USER_UPDATED,
            userId: actorUserId,
            recordId: id,
            metadata: {
              origin: "admin_users",
              actorUserId,
              targetUserId: id,
              changedFields: ["permissionProfileId"],
              permissionProfileIdBefore: current.permissionProfileId,
              permissionProfileIdAfter: nextPermissionProfileId,
              roleBefore: currentRoles[0] ?? null,
              roleAfter: nextRoles[0] ?? null,
              ...this.auditRequestMetadata(context),
            },
          });
        }

        return this.findAdminUserOrThrowTx(tx, updated.id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).then((user) => this.toAdminUser(user));
  }

  async updateAdminUserInstitutions(
    userId: string,
    institutionIds: string[],
    actor: AdminActor,
    context: AuditContext = {},
  ): Promise<AdminUserResponse> {
    const actorUserId = this.actorUserId(actor);
    if (userId === actorUserId) {
      throw new ForbiddenException("Nao e permitido alterar as proprias instituicoes");
    }
    const uniqueInstitutionIds = this.uniqueIds(institutionIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await this.findAdminUserOrThrowTx(tx, userId);
      this.assertActorCanManageCurrentUser(actor, userId, this.roleCodes(current));
      this.assertActorCanChangeCurrentUserInstitutions(
        actor,
        this.roleCodes(current),
      );
      const beforeInstitutionIds = this.institutionIds(current);
      this.assertUserInstitutionRequirement(
        this.roleCodes(current)[0]!,
        uniqueInstitutionIds,
      );
      await this.assertInstitutionsExist(tx, uniqueInstitutionIds);

      if (this.sameIds(beforeInstitutionIds, uniqueInstitutionIds)) {
        return current;
      }

      await tx.userInstitution.deleteMany({ where: { userId } });
      if (uniqueInstitutionIds.length > 0) {
        await tx.userInstitution.createMany({
          data: uniqueInstitutionIds.map((institutionId) => ({
            userId,
            institutionId,
          })),
          skipDuplicates: true,
        });
      }

      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.USER_INSTITUTIONS_CHANGED,
        userId: actorUserId,
        recordId: userId,
        metadata: {
          origin: "admin_users",
          actorUserId,
          targetUserId: userId,
          institutionIdsBefore: beforeInstitutionIds,
          institutionIdsAfter: uniqueInstitutionIds,
          ...this.auditRequestMetadata(context),
        },
      });

      return this.findAdminUserOrThrowTx(tx, userId);
    });

    return this.toAdminUser(updated);
  }

  async blockAdminUser(
    userId: string,
    actor: AdminActor,
    context: AuditContext = {},
  ): Promise<AdminUserResponse> {
    const actorUserId = this.actorUserId(actor);
    if (userId === actorUserId) {
      throw new ForbiddenException("Nao e permitido bloquear a propria conta");
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const current = await this.findAdminUserOrThrowTx(tx, userId);
        this.assertActorCanManageCurrentUser(actor, userId, this.roleCodes(current));
        this.assertActorCanChangeCurrentUserStatus(actor, this.roleCodes(current));
        await this.assertActiveSuperAdminRemains(tx, userId, {
          roles: this.roleCodes(current),
          status: UserStatus.INACTIVE,
        });
        const blocked = await tx.user.update({
          where: { id: userId },
          data: {
            status: UserStatus.INACTIVE,
            blockedAt: now,
            passwordChangedAt: now,
          },
          include: this.adminUserInclude(),
        });
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.USER_BLOCKED,
          userId: actorUserId,
          recordId: userId,
          metadata: {
            origin: "admin_users",
            actorUserId,
            targetUserId: userId,
            statusBefore: current.status,
            statusAfter: UserStatus.INACTIVE,
            blockedAtBefore: current.blockedAt?.toISOString() ?? null,
            blockedAtAfter: now.toISOString(),
            credentialUpdated: true,
            ...this.auditRequestMetadata(context),
          },
        });
        return blocked;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.toAdminUser(updated);
  }

  async unblockAdminUser(
    userId: string,
    actor: AdminActor,
    context: AuditContext = {},
  ): Promise<AdminUserResponse> {
    const actorUserId = this.actorUserId(actor);
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await this.findAdminUserOrThrowTx(tx, userId);
      this.assertActorCanManageCurrentUser(actor, userId, this.roleCodes(current));
      this.assertActorCanChangeCurrentUserStatus(actor, this.roleCodes(current));
      const unblocked = await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          blockedAt: null,
        },
        include: this.adminUserInclude(),
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.USER_UNBLOCKED,
        userId: actorUserId,
        recordId: userId,
        metadata: {
          origin: "admin_users",
          actorUserId,
          targetUserId: userId,
          statusBefore: current.status,
          statusAfter: UserStatus.ACTIVE,
          blockedAtBefore: current.blockedAt?.toISOString() ?? null,
          blockedAtAfter: null,
          mustChangePasswordBefore: current.mustChangePassword,
          mustChangePasswordAfter: current.mustChangePassword,
          ...this.auditRequestMetadata(context),
        },
      });
      return unblocked;
    });

    return this.toAdminUser(updated);
  }

  async resetAdminUserTemporaryPassword(
    userId: string,
    actor: AdminActor,
    context: AuditContext = {},
  ) {
    const actorUserId = this.actorUserId(actor);
    if (userId === actorUserId) {
      throw new ForbiddenException(
        "Use Minha Conta para alterar a propria senha",
      );
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.hashPassword(temporaryPassword);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await this.findAdminUserOrThrowTx(tx, userId);
      this.assertActorCanManageCurrentUser(actor, userId, this.roleCodes(current));
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: now,
        },
        include: this.adminUserInclude(),
      });
      await this.recordAuditTx(tx, {
        eventType: AdministrativeAuditEventType.USER_PASSWORD_RESET,
        userId: actorUserId,
        recordId: userId,
        metadata: {
          origin: "admin_users",
          actorUserId,
          targetUserId: userId,
          mustChangePasswordBefore: current.mustChangePassword,
          mustChangePasswordAfter: true,
          credentialUpdated: true,
          ...this.auditRequestMetadata(context),
        },
      });
      return user;
    });

    return {
      user: this.toAdminUser(updated),
      temporaryPassword,
    };
  }

  async updateOwnAccount(
    userId: string,
    input: UpdateOwnAccountDto,
    context: AuditContext = {},
  ): Promise<{ user: AccountUserResponse }> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: { include: { role: true } },
          institutions: { select: { institutionId: true } },
        },
      });
      if (!current) {
        throw new NotFoundException("Usuario nao encontrado");
      }

      const name = input.name.trim();
      const user = await tx.user.update({
        where: { id: userId },
        data: { name },
        include: {
          roles: { include: { role: true } },
          institutions: { select: { institutionId: true } },
        },
      });

      if (current.name !== name) {
        await this.recordAuditTx(tx, {
          eventType: AdministrativeAuditEventType.USER_UPDATED,
          userId,
          recordId: userId,
          metadata: {
            origin: "account",
            targetUserId: userId,
            changedFields: ["name"],
            before: { name: current.name },
            after: { name },
            ...this.auditRequestMetadata(context),
          },
        });
      }

      return user;
    });

    return { user: this.toAccountUser(this.toAuthUser(updated)) };
  }

  async changeOwnPassword(
    userId: string,
    input: ChangePasswordDto,
    context: { ip?: string; userAgent?: string | string[] },
  ): Promise<{ ok: true; requiresLogin: true }> {
    if (input.confirmPassword !== undefined && input.confirmPassword !== input.newPassword) {
      throw new BadRequestException("Confirmacao de senha divergente");
    }

    const user = await this.findByIdWithPassword(userId);
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("Usuario inativo");
    }

    const currentPasswordMatches = await bcrypt.compare(
      input.currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordMatches) {
      throw new BadRequestException("Senha atual invalida");
    }

    assertPasswordPolicy({
      password: input.newPassword,
      currentPassword: input.currentPassword,
      name: user.name,
      email: user.email,
    });

    const passwordHash = await this.hashPassword(input.newPassword);
    const now = new Date();
    const wasRequired = user.mustChangePassword;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: now,
        },
      });

      await this.recordAuditTx(tx, {
        eventType: wasRequired
          ? AdministrativeAuditEventType.USER_FIRST_ACCESS_PASSWORD_CHANGED
          : AdministrativeAuditEventType.USER_PASSWORD_CHANGED,
        userId,
        recordId: userId,
        metadata: {
          origin: wasRequired ? "first_access" : "account",
          targetUserId: userId,
          mustChangePasswordBefore: wasRequired,
          mustChangePasswordAfter: false,
          credentialUpdated: true,
          ...this.auditRequestMetadata(context),
        },
      });
    });

    return { ok: true, requiresLogin: true };
  }

  toAuthUser(user: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    mustChangePassword?: boolean;
    passwordChangedAt?: Date | null;
    permissionProfileId?: string | null;
    roles: Array<{ role: { code: RoleCode } }>;
    institutions?: Array<{ institutionId: string }>;
  }): AuthUser {
    const institutionIds = Array.from(
      new Set(user.institutions?.map((item) => item.institutionId) ?? []),
    );
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      passwordChangedAt: user.passwordChangedAt,
      permissionProfileId: user.permissionProfileId ?? null,
      roles: user.roles.map((userRole) => userRole.role.code),
      institutionId: institutionIds.length === 1 ? institutionIds[0] : null,
      institutionIds,
    };
  }

  toAccountUser(user: AuthUser): AccountUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: user.roles,
      institutionIds: user.institutionIds ?? [],
      mustChangePassword: user.mustChangePassword ?? false,
    };
  }

  private adminUserInclude() {
    return {
      roles: { include: { role: true } },
      permissionProfile: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      institutions: {
        include: {
          institution: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    } satisfies Prisma.UserInclude;
  }

  private adminUserOrderBy(sort: AdminUserSort, order: SortOrder) {
    const direction = order === SortOrder.DESC ? "desc" : "asc";
    const fieldBySort = {
      [AdminUserSort.CREATED_AT]: "createdAt",
      [AdminUserSort.EMAIL]: "email",
      [AdminUserSort.LAST_LOGIN_AT]: "lastLoginAt",
      [AdminUserSort.NAME]: "name",
      [AdminUserSort.STATUS]: "status",
      [AdminUserSort.UPDATED_AT]: "updatedAt",
    } as const;
    return { [fieldBySort[sort] ?? "name"]: direction };
  }

  private buildAdminUserWhere(
    query: ListAdminUsersDto,
    actor?: AdminActor,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search.toLowerCase(), mode: "insensitive" } },
      ];
    }
    if (query.role) {
      where.roles = { some: { role: { code: query.role } } };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.institutionId) {
      where.institutions = { some: { institutionId: query.institutionId } };
    }
    if (query.neverLoggedIn === true) {
      where.lastLoginAt = null;
    }
    if (query.mustChangePassword !== undefined) {
      where.mustChangePassword = query.mustChangePassword;
    }
    if (query.withoutInstitution === true) {
      where.institutions = { none: {} };
    }
    if (actor && this.actorIsAdministrator(actor) && !this.actorIsSuperAdmin(actor)) {
      where.NOT = {
        roles: { some: { role: { code: RoleCode.SUPER_ADMIN } } },
      };
    }
    return where;
  }

  private async findAdminUserOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.adminUserInclude(),
    });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }
    return user;
  }

  private async findAdminUserOrThrowTx(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const user = await tx.user.findUnique({
      where: { id },
      include: this.adminUserInclude(),
    });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }
    return user;
  }

  private toAdminUser(user: UserWithAdminRelations): AdminUserResponse {
    const roles = this.roleCodes(user);
    const institutionIds = this.institutionIds(user);
    const globalAccess = roles.includes(RoleCode.SUPER_ADMIN);
    const institutionScope = globalAccess
      ? "global"
      : institutionIds.length > 0
        ? "restricted"
        : "none";
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      position: user.position,
      status: user.status,
      permissionProfileId: user.permissionProfileId,
      permissionProfile: user.permissionProfile,
      roles,
      institutionIds,
      institutions: user.institutions.map((item) => ({
        id: item.institution.id,
        name: item.institution.name,
        status: item.institution.status,
      })),
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      blockedAt: user.blockedAt,
      effectivePermissions: {
        canAdminUsers: roles.includes(RoleCode.SUPER_ADMIN),
        globalAccess,
        institutionScope,
      },
    };
  }

  private roleCodes(user: { roles: Array<{ role: { code: RoleCode } }> }) {
    return user.roles.map((item) => item.role.code);
  }

  private institutionIds(user: { institutions?: Array<{ institutionId: string }> }) {
    return Array.from(
      new Set(user.institutions?.map((item) => item.institutionId) ?? []),
    );
  }

  private uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids)).sort();
  }

  private sameIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((id, index) => id === right[index]);
  }

  private assertAssignableRoleForCreate(role: RoleCode): void {
    if (!CREATE_ADMIN_ASSIGNABLE_ROLES.has(role)) {
      throw new BadRequestException("Perfil nao permitido nesta sprint");
    }
  }

  private assertAssignableRoleForUpdate(
    role: RoleCode,
    currentRoles: RoleCode[],
  ): void {
    if (CREATE_ADMIN_ASSIGNABLE_ROLES.has(role)) {
      return;
    }
    if (
      role === TRANSITION_ASSIGNABLE_ROLE &&
      currentRoles.includes(TRANSITION_ASSIGNABLE_ROLE)
    ) {
      return;
    }
    throw new BadRequestException("Perfil nao permitido nesta sprint");
  }

  private actorUserId(actor: AdminActor): string {
    return actor.id;
  }

  private actorRoles(actor: AdminActor): RoleCode[] {
    return actor.roles;
  }

  private actorIsSuperAdmin(actor: AdminActor): boolean {
    return this.actorRoles(actor).includes(RoleCode.SUPER_ADMIN);
  }

  private actorIsAdministrator(actor: AdminActor): boolean {
    return this.actorRoles(actor).includes(RoleCode.ADMINISTRATOR);
  }

  private assertActorCanCreateUser(actor: AdminActor, role: RoleCode): void {
    if (this.actorIsSuperAdmin(actor)) {
      this.assertAssignableRoleForCreate(role);
      return;
    }
    if (this.actorIsAdministrator(actor) && role === RoleCode.USER) {
      return;
    }
    throw new ForbiddenException("ADMINISTRATOR pode criar somente usuarios USER");
  }

  private assertActorCanManageCurrentUser(
    actor: AdminActor,
    targetUserId: string,
    currentRoles: RoleCode[],
  ): void {
    if (this.actorIsSuperAdmin(actor)) {
      return;
    }
    if (
      this.actorIsAdministrator(actor) &&
      this.actorUserId(actor) !== targetUserId &&
      currentRoles.length === 1 &&
      (currentRoles.includes(RoleCode.USER) ||
        currentRoles.includes(RoleCode.ADMINISTRATOR))
    ) {
      return;
    }
    throw new ForbiddenException(
      "ADMINISTRATOR pode administrar somente usuarios USER e ADMINISTRATOR",
    );
  }

  private assertActorCanAssignRoleForUpdate(
    actor: AdminActor,
    role: RoleCode,
    currentRoles: RoleCode[],
  ): void {
    if (this.actorIsSuperAdmin(actor)) {
      this.assertAssignableRoleForUpdate(role, currentRoles);
      return;
    }
    if (
      this.actorIsAdministrator(actor) &&
      currentRoles.length === 1 &&
      role === currentRoles[0] &&
      (currentRoles.includes(RoleCode.USER) ||
        currentRoles.includes(RoleCode.ADMINISTRATOR))
    ) {
      return;
    }
    throw new ForbiddenException("ADMINISTRATOR nao pode alterar nivel de usuario");
  }

  private assertActorCanViewCurrentUser(
    actor: AdminActor,
    currentRoles: RoleCode[],
  ): void {
    if (this.actorIsSuperAdmin(actor)) {
      return;
    }
    if (
      this.actorIsAdministrator(actor) &&
      !currentRoles.includes(RoleCode.SUPER_ADMIN)
    ) {
      return;
    }
    throw new ForbiddenException("Usuario nao autorizado");
  }

  private assertActorCanChangeCurrentUserStatus(
    actor: AdminActor,
    currentRoles: RoleCode[],
  ): void {
    if (this.actorIsSuperAdmin(actor)) {
      return;
    }
    if (this.actorIsAdministrator(actor) && currentRoles.includes(RoleCode.USER)) {
      return;
    }
    throw new ForbiddenException(
      "ADMINISTRATOR pode alterar status somente de usuarios USER",
    );
  }

  private assertActorCanChangeCurrentUserInstitutions(
    actor: AdminActor,
    currentRoles: RoleCode[],
  ): void {
    if (this.actorIsSuperAdmin(actor)) {
      return;
    }
    if (this.actorIsAdministrator(actor) && currentRoles.includes(RoleCode.USER)) {
      return;
    }
    throw new ForbiddenException(
      "ADMINISTRATOR pode alterar instituicoes somente de usuarios USER",
    );
  }

  private async resolvePermissionProfileId(
    tx: Prisma.TransactionClient | PrismaService,
    role: RoleCode,
    requestedProfileId: string | null | undefined,
    currentProfileId?: string | null,
  ): Promise<string | null> {
    if (role !== RoleCode.USER) {
      return null;
    }
    const profileId = requestedProfileId ?? currentProfileId ?? null;
    if (!profileId) {
      throw new BadRequestException("Perfil de permissoes obrigatorio para USER");
    }
    const profile = await tx.permissionProfile.findFirst({
      where: {
        id: profileId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!profile) {
      throw new BadRequestException("Perfil de permissoes ativo obrigatorio para USER");
    }
    return profile.id;
  }

  private assertUserInstitutionRequirement(
    role: RoleCode,
    institutionIds: string[],
  ) {
    if (role === RoleCode.USER && institutionIds.length === 0) {
      throw new BadRequestException(
        "Usuario deve possuir ao menos uma instituicao vinculada.",
      );
    }
  }

  private async assertInstitutionsExist(
    tx: Prisma.TransactionClient,
    institutionIds: string[],
  ) {
    if (institutionIds.length === 0) {
      return;
    }
    const existing = await tx.institution.findMany({
      where: { id: { in: institutionIds } },
      select: { id: true },
    });
    if (existing.length !== institutionIds.length) {
      throw new BadRequestException("Uma ou mais instituicoes nao existem");
    }
  }

  private async assertActiveSuperAdminRemains(
    tx: Prisma.TransactionClient,
    targetUserId: string,
    next: { roles: RoleCode[]; status: UserStatus },
  ) {
    const targetRemainsActiveSuperAdmin =
      next.status === UserStatus.ACTIVE &&
      next.roles.includes(RoleCode.SUPER_ADMIN);
    const otherActiveSuperAdmins = await tx.user.count({
      where: {
        id: { not: targetUserId },
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: RoleCode.SUPER_ADMIN } } },
      },
    });
    if (!targetRemainsActiveSuperAdmin && otherActiveSuperAdmins < 1) {
      throw new BadRequestException("Ao menos um Super Admin ativo deve permanecer");
    }
  }

  private changedBasicUserFields(
    current: UserWithAdminRelations,
    input: UpdateAdminUserDto,
  ) {
    const changed: string[] = [];
    if (input.name && input.name.trim() !== current.name) {
      changed.push("name");
    }
    if (input.email && input.email.toLowerCase() !== current.email) {
      changed.push("email");
    }
    if (
      input.phone !== undefined &&
      this.normalizePhone(input.phone) !== current.phone
    ) {
      changed.push("phone");
    }
    if (
      input.position !== undefined &&
      this.normalizeOptionalText(input.position) !== current.position
    ) {
      changed.push("position");
    }
    return changed;
  }

  private basicUserSnapshot(
    user: {
      email: string;
      name: string;
      phone?: string | null;
      position?: string | null;
    },
    fields: string[],
  ): Prisma.InputJsonObject {
    const snapshot: Record<string, Prisma.InputJsonValue> = {};
    if (fields.includes("name")) {
      snapshot.name = user.name;
    }
    if (fields.includes("email")) {
      snapshot.email = user.email;
    }
    if (fields.includes("phone")) {
      snapshot.phone = (user.phone ?? null) as unknown as Prisma.InputJsonValue;
    }
    if (fields.includes("position")) {
      snapshot.position = (user.position ?? null) as unknown as Prisma.InputJsonValue;
    }
    return snapshot as Prisma.InputJsonObject;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private normalizePhone(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }
    const digits = trimmed.replace(/\D/g, "");
    if (!digits || digits.length > 30) {
      throw new BadRequestException("Telefone invalido");
    }
    return digits;
  }

  private auditRequestMetadata(context: AuditContext): Prisma.InputJsonObject {
    const metadata: Record<string, Prisma.InputJsonValue> = {};
    if (context.ip) {
      metadata.ip = context.ip;
    }
    if (context.userAgent) {
      const userAgent = Array.isArray(context.userAgent)
        ? context.userAgent.join(", ")
        : context.userAgent;
      metadata.userAgent = userAgent.slice(0, MAX_AUDIT_USER_AGENT_LENGTH);
    }
    return metadata as Prisma.InputJsonObject;
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.values.passwordHashRounds);
  }

  private async recordAuditTx(
    tx: Prisma.TransactionClient,
    input: {
      eventType: AdministrativeAuditEventType;
      userId: string;
      recordId: string;
      metadata?: Prisma.InputJsonObject;
    },
  ) {
    await tx.administrativeAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        domain: "users",
        recordId: input.recordId,
        metadata: sanitizeAdministrativeAuditMetadata(input.metadata ?? {}),
      },
    });
  }
}
