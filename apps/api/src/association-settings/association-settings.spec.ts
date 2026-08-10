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
  "Logo institucional seed indisponivel",
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

await testSeedLogoCreatedForCleanSettings();
await testSeedLogoRestoredWhenReferenceExistsButFileIsMissing();
await testExistingSeedLogoIsNotDuplicated();
await testCustomLogoIsNotOverwritten();

async function testSeedLogoCreatedForCleanSettings() {
  const context = buildSeedLogoService({
    readErrorCode: "ENOENT",
  });

  await context.ensureSeededLogo(null);

  assert.deepEqual(context.storage.writes, [
    "association/logo/seed-atretu-logo.png",
  ]);
  assert.equal(context.storage.lastBufferLength, 96456);
  assert.equal(context.prisma.updateCalls.length, 1);
  assert.equal(
    context.prisma.updateCalls[0]!.data.logoStorageKey,
    "association/logo/seed-atretu-logo.png",
  );
}

async function testSeedLogoRestoredWhenReferenceExistsButFileIsMissing() {
  const context = buildSeedLogoService({
    readErrorCode: "ENOENT",
  });

  await context.ensureSeededLogo("association/logo/seed-atretu-logo.png");

  assert.deepEqual(context.storage.reads, [
    "association/logo/seed-atretu-logo.png",
  ]);
  assert.deepEqual(context.storage.writes, [
    "association/logo/seed-atretu-logo.png",
  ]);
  assert.equal(context.prisma.updateCalls.length, 0);
}

async function testExistingSeedLogoIsNotDuplicated() {
  const context = buildSeedLogoService();

  await context.ensureSeededLogo("association/logo/seed-atretu-logo.png");

  assert.deepEqual(context.storage.reads, [
    "association/logo/seed-atretu-logo.png",
  ]);
  assert.deepEqual(context.storage.writes, []);
  assert.equal(context.prisma.updateCalls.length, 0);
}

async function testCustomLogoIsNotOverwritten() {
  const context = buildSeedLogoService();

  await context.ensureSeededLogo("association/logo/2026-08-10/custom.png");

  assert.deepEqual(context.storage.reads, []);
  assert.deepEqual(context.storage.writes, []);
  assert.equal(context.prisma.updateCalls.length, 0);
}

function buildSeedLogoService(options: { readErrorCode?: string } = {}) {
  const updateCalls: Array<{ data: Record<string, unknown> }> = [];
  const storage = {
    lastBufferLength: 0,
    reads: [] as string[],
    writes: [] as string[],
    async read(storageKey: string) {
      this.reads.push(storageKey);
      if (options.readErrorCode) {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = options.readErrorCode;
        throw error;
      }
      return Buffer.from("seed");
    },
    async write(storageKey: string, buffer: Buffer) {
      this.writes.push(storageKey);
      this.lastBufferLength = buffer.byteLength;
    },
  };
  const prisma = {
    associationSettings: {
      async update(input: { data: Record<string, unknown> }) {
        updateCalls.push(input);
        return input;
      },
    },
  };
  const seededLogoService = Object.create(AssociationSettingsService.prototype) as {
    ensureSeededLogo(currentStorageKey: string | null): Promise<void>;
    prisma: typeof prisma;
    storage: typeof storage;
  };
  seededLogoService.prisma = prisma;
  seededLogoService.storage = storage;
  return {
    ensureSeededLogo: (currentStorageKey: string | null) =>
      seededLogoService.ensureSeededLogo(currentStorageKey),
    prisma: { updateCalls },
    storage,
  };
}
