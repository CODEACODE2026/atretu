import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AdministrativeAuditEventType, RoleCode } from "@prisma/client";
import { RolesGuard } from "../auth/roles.guard.js";
import { AdminUsersController } from "../users/admin-users.controller.js";
import { PermissionProfilesController } from "./permission-profiles.controller.js";
import { PermissionProfilesService } from "./permission-profiles.service.js";
import {
  PermissionProfileSort,
  PermissionProfileStatusFilter,
  SortOrder,
} from "./dto/permission-profiles.dto.js";

const controller = readFileSync(
  new URL("./permission-profiles.controller.ts", import.meta.url),
  "utf8",
);
const serviceSource = readFileSync(
  new URL("./permission-profiles.service.ts", import.meta.url),
  "utf8",
);

assert.match(controller, /@Controller\("admin\/permission-profiles"\)/);
assert.match(controller, /@Roles\(RoleCode\.SUPER_ADMIN\)/);
assert.doesNotMatch(controller, /RoleCode\.(ADMINISTRATOR|USER|SECRETARIA|GESTOR)/);
assert.doesNotMatch(controller, /@Delete\(/);
assert.match(controller, /@Patch\(":id\/inactivate"\)/);
assert.match(controller, /@Patch\(":id\/reactivate"\)/);
assert.match(controller, /@Get\("catalog"\)/);
assert.match(controller, /@CurrentUser\(\) user: AuthUser/);
assert.match(serviceSource, /isDelegatablePermissionKey/);
assert.match(serviceSource, /isActiveDelegatablePermissionKey/);
assert.match(serviceSource, /PermissionProfileStatusFilter\.INACTIVE/);
assert.match(serviceSource, /PERMISSION_DEPENDENCIES/);
assert.match(serviceSource, /domain: "permission_profiles"/);
assert.match(serviceSource, /permissionsChanged/);

const service = new PermissionProfilesService({} as never, {} as never);
assert.throws(
  () =>
    Reflect.apply(service["normalizePermissions"], service, [
      ["students.view", "legacyImport.access"],
    ]),
  BadRequestException,
);
assert.throws(
  () =>
    Reflect.apply(service["normalizePermissions"], service, [
      ["students.view", "settings.view"],
    ]),
  BadRequestException,
);
assert.deepEqual(
  Reflect.apply(service["normalizePermissions"], service, [
    ["students.update", "students.update"],
  ]),
  ["students.update", "students.view"],
);
assert.throws(
  () =>
    Reflect.apply(service["normalizePermissions"], service, [
      ["finance.invoices.manage"],
    ]),
  BadRequestException,
);
assert.throws(
  () =>
    Reflect.apply(service["normalizePermissions"], service, [
      ["academicYears.manage"],
    ]),
  BadRequestException,
);

type MemoryProfile = {
  createdAt: Date;
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
  permissions: string[];
  updatedAt: Date;
  usersCount: number;
};

const now = new Date("2026-08-21T17:00:00.000Z");
const profiles: MemoryProfile[] = [
  {
    createdAt: now,
    description: "Perfil ativo",
    id: "profile-active",
    isActive: true,
    name: "Atendimento",
    permissions: ["dashboard.view"],
    updatedAt: now,
    usersCount: 2,
  },
  {
    createdAt: now,
    description: "Perfil inativo",
    id: "profile-inactive",
    isActive: false,
    name: "Consulta",
    permissions: ["students.view"],
    updatedAt: now,
    usersCount: 1,
  },
];
const auditEntries: Array<{
  domain: string;
  eventType: AdministrativeAuditEventType;
  metadata?: Record<string, unknown>;
  recordId: string;
  userId?: string;
}> = [];
let failNextPermissionProfileUpdate = false;

function materialize(profile: MemoryProfile) {
  return {
    ...profile,
    _count: { users: profile.usersCount },
    permissions: profile.permissions.map((permissionKey) => ({ permissionKey })),
  };
}

const tx = {
  permissionProfile: {
    update({ data, where }: { data: any; where: { id: string } }) {
      if (failNextPermissionProfileUpdate) {
        failNextPermissionProfileUpdate = false;
        throw new Error("simulated permission write failure");
      }
      const profile = profiles.find((item) => item.id === where.id);
      assert.ok(profile);
      if (data.name !== undefined) profile.name = data.name;
      if (data.description !== undefined) profile.description = data.description;
      if (data.isActive !== undefined) profile.isActive = data.isActive;
      if (data.permissions?.create) {
        profile.permissions = data.permissions.create.map(
          (item: { permissionKey: string }) => item.permissionKey,
        );
      }
      profile.updatedAt = new Date("2026-08-21T17:05:00.000Z");
      return materialize(profile);
    },
  },
  permissionProfilePermission: {
    deleteMany({ where }: { where: { profileId: string } }) {
      const profile = profiles.find((item) => item.id === where.profileId);
      assert.ok(profile);
      profile.permissions = [];
      return { count: 1 };
    },
  },
};

const prisma = {
  async $transaction(callback: (transaction: typeof tx) => unknown) {
    const snapshot = profiles.map((profile) => ({
      ...profile,
      permissions: [...profile.permissions],
    }));
    try {
      return await callback(tx);
    } catch (error) {
      profiles.splice(0, profiles.length, ...snapshot);
      throw error;
    }
  },
  permissionProfile: {
    count({ where }: { where: { isActive?: boolean } }) {
      return profiles.filter((profile) =>
        where.isActive === undefined ? true : profile.isActive === where.isActive,
      ).length;
    },
    create({ data }: { data: any }) {
      const created: MemoryProfile = {
        createdAt: now,
        description: data.description ?? null,
        id: "profile-created",
        isActive: data.isActive,
        name: data.name,
        permissions: data.permissions.create.map(
          (item: { permissionKey: string }) => item.permissionKey,
        ),
        updatedAt: now,
        usersCount: 0,
      };
      profiles.push(created);
      return materialize(created);
    },
    findFirst({ where }: { where: { id?: { not?: string }; name?: { equals?: string } } }) {
      return profiles.find((profile) => {
        if (where.id?.not && profile.id === where.id.not) return false;
        if (where.name?.equals) {
          return profile.name.toLowerCase() === where.name.equals.toLowerCase();
        }
        return false;
      }) ?? null;
    },
    findMany({ where }: { where: { isActive?: boolean } }) {
      return profiles
        .filter((profile) =>
          where.isActive === undefined ? true : profile.isActive === where.isActive,
        )
        .map((profile) => materialize(profile));
    },
    findUnique({ where }: { where: { id: string } }) {
      const profile = profiles.find((item) => item.id === where.id);
      return profile ? materialize(profile) : null;
    },
  },
};
const auditedService = new PermissionProfilesService(prisma as never, {
  record(input: (typeof auditEntries)[number]) {
    auditEntries.push(input);
  },
} as never);
const currentUser = { id: "super-admin" };

const listed = await auditedService.list({
  limit: 20,
  order: SortOrder.ASC,
  page: 1,
  sort: PermissionProfileSort.NAME,
  status: PermissionProfileStatusFilter.ACTIVE,
});
assert.equal(listed.data.length, 1);
assert.equal(listed.data[0]?.usersCount, 2);

const activeOptions = await auditedService.listActiveOptions();
assert.deepEqual(activeOptions.map((profile) => profile.id), [
  "profile-active",
]);

await assert.rejects(
  () =>
    auditedService.create(
      {
        description: "Duplicado",
        isActive: true,
        name: " atendimento ",
        permissions: ["dashboard.view"],
      },
      currentUser as never,
    ),
  ConflictException,
);

const created = await auditedService.create(
  {
    description: "Novo",
    isActive: true,
    name: "Academico",
    permissions: ["students.update"],
  },
  currentUser as never,
);
assert.deepEqual(created.permissions, ["students.update", "students.view"]);

const edited = await auditedService.update(
  "profile-created",
  { permissions: ["students.create"] },
  currentUser as never,
);
assert.deepEqual(edited.permissions, ["students.create"]);

const inactivated = await auditedService.setActive(
  "profile-created",
  false,
  currentUser as never,
);
assert.equal(inactivated.isActive, false);
assert.ok(
  auditEntries.some(
    (entry) =>
      entry.domain === "permission_profiles" &&
      entry.eventType === AdministrativeAuditEventType.BASE_RECORD_CREATED,
  ),
);
assert.ok(
  auditEntries.some((entry) => entry.metadata?.permissionsChanged === true),
);

const beforeFailure = profiles.find((profile) => profile.id === "profile-created")!;
const beforeFailurePermissions = [...beforeFailure.permissions];
const auditCountBeforeFailure = auditEntries.length;
failNextPermissionProfileUpdate = true;
await assert.rejects(
  () =>
    auditedService.update(
      "profile-created",
      { name: "Falha", permissions: ["students.create"] },
      currentUser as never,
    ),
  /simulated permission write failure/,
);
const afterFailure = profiles.find((profile) => profile.id === "profile-created")!;
assert.equal(afterFailure.name, beforeFailure.name);
assert.deepEqual(afterFailure.permissions, beforeFailurePermissions);
assert.equal(auditEntries.length, auditCountBeforeFailure);

function permissionProfilesContext(role: RoleCode) {
  return roleContext(PermissionProfilesController, "list", role);
}

function legacyPermissionProfilesContext(role: RoleCode) {
  return roleContext(AdminUsersController, "listPermissionProfiles", role);
}

function roleContext(
  controller: new (...args: never[]) => unknown,
  methodName: string,
  role: RoleCode,
) {
  const handler = Object.getOwnPropertyDescriptor(
    controller.prototype,
    methodName,
  )?.value as () => unknown;
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: "user-1",
          roles: [role],
        },
      }),
    }),
  };
}

const rolesGuard = new RolesGuard(new Reflector());
assert.equal(
  rolesGuard.canActivate(permissionProfilesContext(RoleCode.SUPER_ADMIN) as never),
  true,
);
for (const role of [
  RoleCode.ADMINISTRATOR,
  RoleCode.SECRETARIA,
  RoleCode.USER,
  RoleCode.GESTOR,
]) {
  assert.throws(() =>
    rolesGuard.canActivate(permissionProfilesContext(role) as never),
  );
  assert.throws(() =>
    rolesGuard.canActivate(legacyPermissionProfilesContext(role) as never),
  );
}
assert.equal(
  rolesGuard.canActivate(
    legacyPermissionProfilesContext(RoleCode.SUPER_ADMIN) as never,
  ),
  true,
);

console.log("permission-profiles.spec.ts ok");
