import { ForbiddenException } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import type { AuthUser } from "../users/users.service.js";

export type InstitutionScope =
  | { type: "unrestricted" }
  | { type: "restricted"; institutionIds: string[] }
  | { type: "denied" };

export type InstitutionScopeFilter = string | { in: string[] } | undefined;

export type InstitutionScopeOptions = {
  restrictedRoles?: readonly RoleCode[];
  unrestrictedRoles?: readonly RoleCode[];
};

export const OPERATIONAL_INSTITUTION_SCOPE = {
  restrictedRoles: [RoleCode.SECRETARIA, RoleCode.USER],
  unrestrictedRoles: [RoleCode.SUPER_ADMIN, RoleCode.ADMINISTRATOR],
} as const satisfies InstitutionScopeOptions;

const DEFAULT_INSTITUTION_SCOPE = {
  restrictedRoles: [RoleCode.SECRETARIA],
  unrestrictedRoles: [RoleCode.SUPER_ADMIN],
} as const satisfies InstitutionScopeOptions;

export function getInstitutionScope(
  currentUser?: AuthUser | null,
  options: InstitutionScopeOptions = DEFAULT_INSTITUTION_SCOPE,
): InstitutionScope {
  if (!currentUser) {
    return { type: "unrestricted" };
  }
  if (
    (options.unrestrictedRoles ?? []).some((role) =>
      currentUser.roles.includes(role),
    )
  ) {
    return { type: "unrestricted" };
  }
  if (
    !(options.restrictedRoles ?? []).some((role) =>
      currentUser.roles.includes(role),
    )
  ) {
    return { type: "denied" };
  }

  const ids = [
    ...(currentUser.institutionId ? [currentUser.institutionId] : []),
    ...(currentUser.institutionIds ?? []),
  ];
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  return uniqueIds.length > 0
    ? { type: "restricted", institutionIds: uniqueIds }
    : { type: "denied" };
}

export function scopedInstitutionFilter(
  currentUser: AuthUser | undefined,
  requestedInstitutionId?: string,
  options?: InstitutionScopeOptions,
): InstitutionScopeFilter {
  const scope = getInstitutionScope(currentUser, options);
  if (scope.type === "unrestricted") {
    return requestedInstitutionId;
  }
  if (scope.type === "denied") {
    if (requestedInstitutionId) {
      throw new ForbiddenException("Acesso negado");
    }
    return { in: [] };
  }
  if (requestedInstitutionId) {
    if (!scope.institutionIds.includes(requestedInstitutionId)) {
      throw new ForbiddenException("Acesso negado");
    }
    return requestedInstitutionId;
  }

  return scope.institutionIds.length === 1
    ? scope.institutionIds[0]
    : { in: scope.institutionIds };
}

export function assertInstitutionInScope(
  currentUser: AuthUser | undefined,
  institutionId: string | null | undefined,
  options?: InstitutionScopeOptions,
) {
  const scope = getInstitutionScope(currentUser, options);
  if (scope.type === "unrestricted") {
    return;
  }
  if (
    !institutionId ||
    scope.type === "denied" ||
    !scope.institutionIds.includes(institutionId)
  ) {
    throw new ForbiddenException("Acesso negado");
  }
}

export function scopedInstitutionIds(
  currentUser: AuthUser | undefined,
  options?: InstitutionScopeOptions,
) {
  const scope = getInstitutionScope(currentUser, options);
  if (scope.type === "unrestricted") {
    return null;
  }
  return scope.type === "restricted" ? scope.institutionIds : [];
}
