import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RoleCode, UserStatus, type User } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: RoleCode[];
  institutionId?: string | null;
  institutionIds?: string[];
};

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async updateUserInstitutions(
    userId: string,
    institutionIds: string[],
  ): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException("Usuario nao encontrado");
    }

    const uniqueInstitutionIds = Array.from(new Set(institutionIds));
    const existingInstitutions = uniqueInstitutionIds.length
      ? await this.prisma.institution.findMany({
          where: { id: { in: uniqueInstitutionIds } },
          select: { id: true },
        })
      : [];
    if (existingInstitutions.length !== uniqueInstitutionIds.length) {
      throw new BadRequestException("Uma ou mais instituicoes nao existem");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
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
      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          roles: { include: { role: true } },
          institutions: { select: { institutionId: true } },
        },
      });
    });

    return this.toAuthUser(updated);
  }

  toAuthUser(user: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
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
      roles: user.roles.map((userRole) => userRole.role.code),
      institutionId: institutionIds.length === 1 ? institutionIds[0] : null,
      institutionIds,
    };
  }
}
