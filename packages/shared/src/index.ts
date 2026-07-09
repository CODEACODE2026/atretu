export const projectName = "Atretu";

export type AppEnvironment = "development" | "test" | "production";

export const roles = {
  superAdmin: "SUPER_ADMIN",
  secretaria: "SECRETARIA",
} as const;

export type RoleCode = (typeof roles)[keyof typeof roles];
