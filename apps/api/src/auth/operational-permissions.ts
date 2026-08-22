import { SetMetadata } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import {
  ACTIVE_DELEGATABLE_PERMISSION_KEYS,
  isPermissionKey,
  type PermissionKey,
} from "./permission-catalog.js";

export const OPERATIONAL_PERMISSIONS_KEY = "operationalPermissions";

export const SPRINT_OPERATIONAL_PERMISSION_KEYS =
  ACTIVE_DELEGATABLE_PERMISSION_KEYS;

export type SprintOperationalPermissionKey =
  (typeof SPRINT_OPERATIONAL_PERMISSION_KEYS)[number];

const SPRINT_OPERATIONAL_PERMISSIONS = new Set<PermissionKey>(
  SPRINT_OPERATIONAL_PERMISSION_KEYS,
);

export function isSprintOperationalPermissionKey(
  value: PermissionKey,
): value is SprintOperationalPermissionKey {
  return SPRINT_OPERATIONAL_PERMISSIONS.has(value);
}
export function OperationalPermission(
  ...permissions: SprintOperationalPermissionKey[]
) {
  for (const permission of permissions) {
    if (!isPermissionKey(permission) || !isSprintOperationalPermissionKey(permission)) {
      throw new Error(`PermissionKey operacional invalida: ${permission}`);
    }
  }

  return SetMetadata(OPERATIONAL_PERMISSIONS_KEY, permissions);
}

export function operationalCapabilitiesForRoles(
  roles: readonly RoleCode[],
): SprintOperationalPermissionKey[] {
  if (
    roles.includes(RoleCode.SUPER_ADMIN) ||
    roles.includes(RoleCode.ADMINISTRATOR) ||
    roles.includes(RoleCode.SECRETARIA)
  ) {
    return [...SPRINT_OPERATIONAL_PERMISSION_KEYS];
  }
  return [];
}
