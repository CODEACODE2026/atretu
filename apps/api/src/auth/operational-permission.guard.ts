import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleCode } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";
import type { AuthUser } from "../users/users.service.js";
import {
  OPERATIONAL_PERMISSIONS_KEY,
  type SprintOperationalPermissionKey,
} from "./operational-permissions.js";

@Injectable()
export class OperationalPermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<SprintOperationalPermissionKey[]>(
        OPERATIONAL_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Acesso negado");
    }

    if (
      user.roles.includes(RoleCode.SUPER_ADMIN) ||
      user.roles.includes(RoleCode.ADMINISTRATOR) ||
      user.roles.includes(RoleCode.SECRETARIA)
    ) {
      return true;
    }

    if (!user.roles.includes(RoleCode.USER)) {
      throw new ForbiddenException("Acesso negado");
    }

    if (!user.permissionProfileId) {
      throw new ForbiddenException("Acesso negado");
    }

    const profile = await this.prisma.permissionProfile.findFirst({
      where: {
        id: user.permissionProfileId,
        isActive: true,
      },
      select: {
        permissions: {
          where: {
            permissionKey: { in: requiredPermissions },
          },
          select: { permissionKey: true },
        },
      },
    });

    if (!profile) {
      throw new ForbiddenException("Acesso negado");
    }

    const granted = new Set(
      profile.permissions.map((permission) => permission.permissionKey),
    );
    const allowed = requiredPermissions.every((permission) =>
      granted.has(permission),
    );
    if (!allowed) {
      throw new ForbiddenException("Acesso negado");
    }

    return true;
  }
}
