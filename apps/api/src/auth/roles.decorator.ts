import { SetMetadata } from "@nestjs/common";
import { RoleCode } from "@prisma/client";

export const ROLES_KEY = "roles";

export const OPERATIONAL_ADMIN_ROLES = [
  RoleCode.SUPER_ADMIN,
  RoleCode.ADMINISTRATOR,
  RoleCode.SECRETARIA,
] as const satisfies readonly RoleCode[];

export const GLOBAL_OPERATIONAL_ADMIN_ROLES = [
  RoleCode.SUPER_ADMIN,
  RoleCode.ADMINISTRATOR,
] as const satisfies readonly RoleCode[];

export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
