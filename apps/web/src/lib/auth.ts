import type { ApiUser, PermissionKey } from "./api";

const SPRINT_CAPABILITY_KEYS = [
  "dashboard.view",
  "students.view",
  "students.create",
  "students.update",
  "students.changeStatus",
  "students.reenroll",
  "students.board.view",
  "students.board.manage",
  "preRegistrations.view",
  "preRegistrations.review",
  "preRegistrations.documents.view",
  "studentCards.view",
  "studentCards.issue",
  "studentCards.invalidate",
  "finance.invoices.view",
  "officialDocuments.view",
  "officialDocuments.issue",
  "baseRecords.view",
  "reports.view",
  "reports.export",
] as const satisfies readonly PermissionKey[];

export type SprintCapability = (typeof SPRINT_CAPABILITY_KEYS)[number];

export function canAccessRestrictedAdmin(user: ApiUser): boolean {
  return user.roles.includes("SUPER_ADMIN");
}

export function canAccessOperationalAdmin(user: ApiUser): boolean {
  return (
    user.roles.includes("SUPER_ADMIN") ||
    user.roles.includes("ADMINISTRATOR") ||
    user.roles.includes("SECRETARIA")
  );
}

export function hasCapability(
  user: ApiUser,
  capability: SprintCapability,
): boolean {
  return user.capabilities?.includes(capability) ?? false;
}

export function hasAnyCapability(
  user: ApiUser,
  capabilities: readonly SprintCapability[],
): boolean {
  return capabilities.some((capability) => hasCapability(user, capability));
}

export function canAccessMigratedArea(
  user: ApiUser,
  area:
    | "dashboard"
    | "pre-registrations"
    | "reenrollments"
    | "official-documents"
    | "base"
    | "reports"
    | "student-cards"
    | "students"
    | "finance",
): boolean {
  if (area === "dashboard") {
    return hasCapability(user, "dashboard.view");
  }
  if (area === "students") {
    return hasCapability(user, "students.view");
  }
  if (area === "reenrollments") {
    return hasCapability(user, "students.reenroll");
  }
  if (area === "student-cards") {
    return hasCapability(user, "studentCards.view");
  }
  if (area === "finance") {
    return hasCapability(user, "finance.invoices.view");
  }
  if (area === "official-documents") {
    return hasCapability(user, "officialDocuments.view");
  }
  if (area === "base") {
    return hasCapability(user, "baseRecords.view");
  }
  if (area === "reports") {
    return hasCapability(user, "reports.view");
  }
  return hasCapability(user, "preRegistrations.view");
}

export function getPrimaryRoleLabel(user: ApiUser): string {
  if (user.roles.includes("SUPER_ADMIN")) {
    return "Super Admin";
  }

  if (user.roles.includes("SECRETARIA")) {
    return "Secretaria";
  }

  if (user.roles.includes("ADMINISTRATOR")) {
    return "Administrador";
  }

  if (user.roles.includes("GESTOR")) {
    return "Gestor";
  }

  return "Usuario";
}
