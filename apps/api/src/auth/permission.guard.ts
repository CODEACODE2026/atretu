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
import { hasAdministratorPermission } from "./administrator-permissions.js";
import type { PermissionKey } from "./permission-catalog.js";
import { PERMISSIONS_KEY } from "./permissions.decorator.js";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const requiredRoles =
      this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length > 0) {
      throw new ForbiddenException("Autorizacao ambigua");
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Acesso negado");
    }

    if (user.roles.includes(RoleCode.SUPER_ADMIN)) {
      return true;
    }

    if (user.roles.includes(RoleCode.ADMINISTRATOR)) {
      const allowed = requiredPermissions.every((permission) =>
        hasAdministratorPermission(permission),
      );
      if (allowed) {
        return true;
      }
      throw new ForbiddenException("Acesso negado");
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
