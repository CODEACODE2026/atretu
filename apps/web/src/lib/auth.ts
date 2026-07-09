import type { ApiUser } from "./api";

export function canAccessRestrictedAdmin(user: ApiUser): boolean {
  return user.roles.includes("SUPER_ADMIN");
}

export function getPrimaryRoleLabel(user: ApiUser): string {
  if (user.roles.includes("SUPER_ADMIN")) {
    return "Super Admin";
  }

  if (user.roles.includes("SECRETARIA")) {
    return "Secretaria";
  }

  return "Usuario";
}
