import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { AssociationSettingsService } from "./association-settings.service.js";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const controller = readFileSync(
  new URL("./association-settings.controller.ts", import.meta.url),
  "utf8",
);
const serviceSource = readFileSync(
  new URL("./association-settings.service.ts", import.meta.url),
  "utf8",
);
const appModule = readFileSync(new URL("../app.module.ts", import.meta.url), "utf8");

for (const fragment of [
  "model AssociationSettings",
  "legalName",
  "logoStorageKey",
  "ASSOCIATION_SETTINGS_UPDATED",
  "ASSOCIATION_LOGO_UPDATED",
]) {
  assert.ok(schema.includes(fragment), `schema must include ${fragment}`);
}

for (const fragment of [
  '@Controller("admin/association-settings")',
  "@Roles(RoleCode.SUPER_ADMIN)",
  '@Post("logo")',
  '@Get("logo")',
  "FileInterceptor",
]) {
  assert.ok(controller.includes(fragment), `controller must include ${fragment}`);
}

for (const fragment of [
  "getSnapshotForDocuments",
  "readLogoForSnapshot",
  "legacySnapshot",
  "detectLogoType",
  "MIME real da logo",
  "logoStorageKey",
  "association/logo/",
  "AdministrativeAuditEventType.ASSOCIATION_SETTINGS_UPDATED",
  "AdministrativeAuditEventType.ASSOCIATION_LOGO_UPDATED",
]) {
  assert.ok(serviceSource.includes(fragment), `service must include ${fragment}`);
}

assert.ok(
  appModule.includes("AssociationSettingsModule"),
  "app module must load association settings module",
);

const service = Object.create(AssociationSettingsService.prototype) as {
  validateCnpj(value: string): string;
  validatePostalCode(value: string): string;
  validateState(value: string): string;
};

assert.equal(service.validateCnpj("49.682.667/0001-00"), "49.682.667/0001-00");
assert.equal(service.validatePostalCode("87890-000"), "87890-000");
assert.equal(service.validateState("pr"), "PR");
assert.throws(() => service.validateCnpj("123"), BadRequestException);
assert.throws(() => service.validatePostalCode("87000"), BadRequestException);
