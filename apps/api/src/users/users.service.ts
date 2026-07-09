import { ConflictException, Injectable } from "@nestjs/common";
import { RoleCode, UserStatus, type User } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: RoleCode[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmailWithPassword(email: string): Promise<
    | (User & {
        roles: Array<{ role: { code: RoleCode } }>;
      })
    | null
  > {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
  }

  async findAuthUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
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
        include: { roles: { include: { role: true } } },
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

  toAuthUser(user: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    roles: Array<{ role: { code: RoleCode } }>;
  }): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: user.roles.map((userRole) => userRole.role.code),
    };
  }
}
