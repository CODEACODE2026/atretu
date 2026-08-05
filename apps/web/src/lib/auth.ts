import type { ApiUser } from "./api";

export function canAccessRestrictedAdmin(user: ApiUser): boolean {
  return user.roles.includes("SUPER_ADMIN");
}

export function canAccessOperationalAdmin(user: ApiUser): boolean {
  return user.roles.includes("SUPER_ADMIN") || user.roles.includes("SECRETARIA");
}

export function getPrimaryRoleLabel(user: ApiUser): string {
  if (user.roles.includes("SUPER_ADMIN")) {
    return "Super Admin";
  }

  if (user.roles.includes("SECRETARIA")) {
    return "Secretaria";
  }

  if (user.roles.includes("GESTOR")) {
    return "Gestor";
  }

  return "Usuario";
}
