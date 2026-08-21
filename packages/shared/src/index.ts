export const projectName = "Atretu";

export type AppEnvironment = "development" | "test" | "production";

export const roles = {
  superAdmin: "SUPER_ADMIN",
  administrator: "ADMINISTRATOR",
  user: "USER",
  secretaria: "SECRETARIA",
  gestor: "GESTOR",
} as const;

export type RoleCode = (typeof roles)[keyof typeof roles];
