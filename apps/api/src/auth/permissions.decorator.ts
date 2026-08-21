import { SetMetadata } from "@nestjs/common";
import { isPermissionKey, type PermissionKey } from "./permission-catalog.js";

export const PERMISSIONS_KEY = "permissions";

export function Permissions(...permissions: PermissionKey[]) {
  for (const permission of permissions) {
    if (!isPermissionKey(permission)) {
      throw new Error(`PermissionKey invalida: ${permission}`);
    }
  }

  return SetMetadata(PERMISSIONS_KEY, permissions);
}
