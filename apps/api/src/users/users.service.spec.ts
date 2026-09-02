import assert from "node:assert/strict";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  RecordStatus,
  RoleCode,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { UsersService } from "./users.service.js";
import { AdminUserSort, SortOrder } from "./dto/admin-users.dto.js";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  permissionProfileId: string | null;
  passwordHash: string;
  status: UserStatus;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  blockedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function createPrisma() {
  const roles = [
    { id: "role-super", code: RoleCode.SUPER_ADMIN, description: "Super" },
    { id: "role-administrator", code: RoleCode.ADMINISTRATOR, description: "Admin" },
    { id: "role-user", code: RoleCode.USER, description: "User" },
    { id: "role-secretaria", code: RoleCode.SECRETARIA, description: "Secretaria" },
    { id: "role-gestor", code: RoleCode.GESTOR, description: "Gestor" },
  ];
  const permissionProfiles = [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Atendimento",
      description: "Operacional",
      isActive: true,
      permissions: [
        { permissionKey: "officialDocuments.view" },
        { permissionKey: "officialDocuments.issue" },
      ],
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Inativo",
      description: null,
      isActive: false,
      permissions: [],
    },
  ];
  const institutions = [
    { id: "11111111-1111-4111-8111-111111111111", name: "Instituicao A", status: RecordStatus.ACTIVE },
    { id: "22222222-2222-4222-8222-222222222222", name: "Instituicao B", status: RecordStatus.ACTIVE },
  ];
  const users: UserRow[] = [];
  const userRoles: Array<{ userId: string; roleId: string }> = [];
  const userInstitutions: Array<{ userId: string; institutionId: string }> = [];
  const audits: Array<{ eventType: AdministrativeAuditEventType; metadata: unknown }> = [];
  let nextUser = 1;

  function hydrate(user: UserRow) {
    return {
      ...user,
      roles: userRoles
        .filter((item) => item.userId === user.id)
        .map((item) => ({
          role: roles.find((role) => role.id === item.roleId)!,
        })),
      institutions: userInstitutions
        .filter((item) => item.userId === user.id)
        .map((item) => ({
          institutionId: item.institutionId,
          institution: institutions.find(
            (institution) => institution.id === item.institutionId,
          )!,
        })),
      permissionProfile:
        permissionProfiles.find(
          (profile) => profile.id === user.permissionProfileId,
        ) ?? null,
    };
  }

  function matchesWhere(user: UserRow, where: Record<string, unknown>) {
    if (where.NOT && matchesWhere(user, where.NOT as Record<string, unknown>)) {
      return false;
    }
    if (where.email && user.email !== where.email) {
      return false;
    }
    if (where.status && user.status !== where.status) {
      return false;
    }
    if (where.mustChangePassword !== undefined && user.mustChangePassword !== where.mustChangePassword) {
      return false;
    }
    if (where.lastLoginAt === null && user.lastLoginAt !== null) {
      return false;
    }
    if (where.id && typeof where.id === "object" && "not" in where.id && user.id === (where.id as { not: string }).not) {
      return false;
    }
    if (where.roles && typeof where.roles === "object" && "some" in where.roles) {
      const roleCode = (((where.roles as { some: { role: { code: RoleCode } } }).some).role).code;
      const hasRole = userRoles.some(
        (item) =>
          item.userId === user.id &&
          roles.find((role) => role.id === item.roleId)?.code === roleCode,
      );
      if (!hasRole) {
        return false;
      }
    }
    if (where.institutions && typeof where.institutions === "object") {
      if ("none" in where.institutions) {
        if (userInstitutions.some((item) => item.userId === user.id)) {
          return false;
        }
      }
      if ("some" in where.institutions) {
        const institutionId = (where.institutions as { some: { institutionId: string } }).some.institutionId;
        if (!userInstitutions.some((item) => item.userId === user.id && item.institutionId === institutionId)) {
          return false;
        }
      }
    }
    if (where.OR && Array.isArray(where.OR)) {
      return where.OR.some((item) => {
        const entry = item as { name?: { contains: string }; email?: { contains: string } };
        return (
          (entry.name && user.name.toLowerCase().includes(entry.name.contains.toLowerCase())) ||
          (entry.email && user.email.toLowerCase().includes(entry.email.contains.toLowerCase()))
        );
      });
    }
    return true;
  }

  const prisma = {
    audits,
    failAudit: false,
    institutions,
    permissionProfiles,
    roles,
    userInstitutions,
    userRoles,
    users,
    $transaction: async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      const snapshots = {
        audits: audits.map((item) => ({ ...item })),
        userInstitutions: userInstitutions.map((item) => ({ ...item })),
        userRoles: userRoles.map((item) => ({ ...item })),
        users: users.map((item) => ({ ...item })),
      };
      try {
        return await (input as (tx: unknown) => Promise<unknown>)(prisma);
      } catch (error) {
        audits.splice(0, audits.length, ...snapshots.audits);
        userInstitutions.splice(
          0,
          userInstitutions.length,
          ...snapshots.userInstitutions,
        );
        userRoles.splice(0, userRoles.length, ...snapshots.userRoles);
        users.splice(0, users.length, ...snapshots.users);
        throw error;
      }
    },
    administrativeAuditLog: {
      create: async ({ data }: { data: { eventType: AdministrativeAuditEventType; metadata: unknown } }) => {
        if (prisma.failAudit) {
          throw new Error("audit failure");
        }
        audits.push(data);
        return data;
      },
    },
    institution: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        institutions.filter((institution) => where.id.in.includes(institution.id)),
    },
    role: {
      findUniqueOrThrow: async ({ where }: { where: { code: RoleCode } }) => {
        const role = roles.find((item) => item.code === where.code);
        assert.ok(role);
        return role;
      },
    },
    permissionProfile: {
      findFirst: async ({ where }: { where: { id: string; isActive?: boolean } }) =>
        permissionProfiles.find(
          (profile) =>
            profile.id === where.id &&
            (where.isActive === undefined || profile.isActive === where.isActive),
        ) ?? null,
      findMany: async () =>
        permissionProfiles
          .filter((profile) => profile.isActive)
          .map(({ id, name, description }) => ({ id, name, description })),
    },
    user: {
      count: async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
        users.filter((user) => matchesWhere(user, where)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const user: UserRow = {
          id: `user-${nextUser++}`,
          name: String(data.name),
          email: String(data.email),
          phone: (data.phone as string | null | undefined) ?? null,
          position: (data.position as string | null | undefined) ?? null,
          permissionProfileId:
            (data.permissionProfileId as string | null | undefined) ?? null,
          passwordHash: String(data.passwordHash),
          status: (data.status as UserStatus | undefined) ?? UserStatus.ACTIVE,
          mustChangePassword: Boolean(data.mustChangePassword),
          passwordChangedAt: data.passwordChangedAt as Date,
          blockedAt: null,
          lastLoginAt: null,
          createdAt: now,
          updatedAt: now,
        };
        users.push(user);
        const roleCreate = data.roles as { create: { roleId: string } };
        userRoles.push({ userId: user.id, roleId: roleCreate.create.roleId });
        const institutionCreate = data.institutions as
          | { createMany: { data: Array<{ institutionId: string }> } }
          | undefined;
        institutionCreate?.createMany.data.forEach((item) => {
          userInstitutions.push({ userId: user.id, institutionId: item.institutionId });
        });
        return hydrate(user);
      },
      findMany: async ({ where = {}, skip = 0, take = 20 }: { where?: Record<string, unknown>; skip?: number; take?: number }) =>
        users.filter((user) => matchesWhere(user, where)).slice(skip, skip + take).map(hydrate),
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
        const user = users.find((item) => item.id === where.id || item.email === where.email);
        return user ? hydrate(user) : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        const index = users.findIndex((item) => item.id === where.id);
        assert.notEqual(index, -1);
        users[index] = { ...users[index]!, ...data, updatedAt: new Date() };
        return hydrate(users[index]!);
      },
    },
    userInstitution: {
      createMany: async ({ data }: { data: Array<{ userId: string; institutionId: string }> }) => {
        data.forEach((item) => {
          if (!userInstitutions.some((current) => current.userId === item.userId && current.institutionId === item.institutionId)) {
            userInstitutions.push(item);
          }
        });
      },
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        for (let index = userInstitutions.length - 1; index >= 0; index -= 1) {
          if (userInstitutions[index]?.userId === where.userId) {
            userInstitutions.splice(index, 1);
          }
        }
      },
    },
    userRole: {
      create: async ({ data }: { data: { userId: string; roleId: string } }) => {
        userRoles.push(data);
      },
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        for (let index = userRoles.length - 1; index >= 0; index -= 1) {
          if (userRoles[index]?.userId === where.userId) {
            userRoles.splice(index, 1);
          }
        }
      },
    },
  };

  return prisma;
}

const prisma = createPrisma();
const service = new UsersService(
  prisma as never,
  { record: async () => undefined } as never,
  { values: { passwordHashRounds: 4 } } as never,
);
const systemSuperActor = {
  email: "system-super@example.com",
  id: "actor-1",
  name: "System Super",
  roles: [RoleCode.SUPER_ADMIN],
  status: UserStatus.ACTIVE,
};

const created = await service.createAdminUser(
  {
    email: " usuario@example.com ",
    institutionIds: [prisma.institutions[0]!.id, prisma.institutions[1]!.id],
    name: " Usuario ",
    permissionProfileId: prisma.permissionProfiles[0]!.id,
    phone: "(44) 99999-8888",
    position: "Atendimento",
    role: RoleCode.USER,
  },
  systemSuperActor,
);
assert.equal(created.user.email, "usuario@example.com");
assert.equal(created.user.mustChangePassword, true);
assert.equal(created.user.institutionIds.length, 2);
assert.equal(created.user.phone, "44999998888");
assert.equal(created.user.position, "Atendimento");
const authMeUser = await service.withOperationalCapabilities({
  email: created.user.email,
  id: created.user.id,
  name: created.user.name,
  permissionProfileId: created.user.permissionProfileId,
  roles: [RoleCode.USER],
  status: UserStatus.ACTIVE,
});
assert.deepEqual(authMeUser.capabilities, [
  "officialDocuments.view",
  "officialDocuments.issue",
]);
assert.equal(created.user.permissionProfileId, prisma.permissionProfiles[0]!.id);
assert.equal(created.user.permissionProfile?.name, "Atendimento");
assert.equal(typeof created.temporaryPassword, "string");
assert.notEqual(prisma.users[0]?.passwordHash, created.temporaryPassword);
assert.equal(await bcrypt.compare(created.temporaryPassword, prisma.users[0]!.passwordHash), true);
assert.equal(JSON.stringify(prisma.audits).includes(created.temporaryPassword), false);
assert.doesNotMatch(JSON.stringify(created.user), /passwordHash|temporaryPassword/);

const activeProfiles = await service.listActivePermissionProfiles();
assert.deepEqual(activeProfiles, [
  {
    id: prisma.permissionProfiles[0]!.id,
    name: "Atendimento",
    description: "Operacional",
  },
]);

const auditCountAfterCreate = prisma.audits.length;
await service.updateAdminUserInstitutions(
  created.user.id,
  [prisma.institutions[1]!.id, prisma.institutions[0]!.id],
  systemSuperActor,
);
assert.equal(prisma.audits.length, auditCountAfterCreate);

const administrator = await service.createAdminUser(
  {
    email: "administrator@example.com",
    institutionIds: [],
    name: "Administrator",
    permissionProfileId: prisma.permissionProfiles[0]!.id,
    role: RoleCode.ADMINISTRATOR,
  },
  systemSuperActor,
);
assert.deepEqual(administrator.user.roles, [RoleCode.ADMINISTRATOR]);
assert.equal(administrator.user.permissionProfileId, null);

const superWithProfile = await service.createAdminUser(
  {
    email: "super-profile@example.com",
    institutionIds: [],
    name: "Super Profile",
    permissionProfileId: prisma.permissionProfiles[0]!.id,
    role: RoleCode.SUPER_ADMIN,
  },
  systemSuperActor,
);
assert.equal(superWithProfile.user.permissionProfileId, null);

await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "gestor@example.com",
        institutionIds: [],
        name: "Gestor",
        role: RoleCode.GESTOR,
      },
      systemSuperActor,
    ),
  (error) => error instanceof BadRequestException,
);

await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "user-sem-instituicao@example.com",
        institutionIds: [],
        name: "Sem instituicao",
        permissionProfileId: prisma.permissionProfiles[0]!.id,
        role: RoleCode.USER,
      },
      systemSuperActor,
    ),
  (error) => error instanceof BadRequestException,
);

await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "user-sem-profile@example.com",
        institutionIds: [prisma.institutions[0]!.id],
        name: "Sem profile",
        role: RoleCode.USER,
      },
      systemSuperActor,
    ),
  (error) => error instanceof BadRequestException,
);

await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "user-profile-inativo@example.com",
        institutionIds: [prisma.institutions[0]!.id],
        name: "Profile inativo",
        permissionProfileId: prisma.permissionProfiles[1]!.id,
        role: RoleCode.USER,
      },
      systemSuperActor,
    ),
  (error) => error instanceof BadRequestException,
);

await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "secretaria@example.com",
        institutionIds: [],
        name: "Secretaria",
        role: RoleCode.SECRETARIA,
      },
      systemSuperActor,
    ),
  (error) => error instanceof BadRequestException,
);

const admin = await service.createAdminUser(
  {
    email: "admin@example.com",
    institutionIds: [],
    name: "Admin",
    role: RoleCode.SUPER_ADMIN,
  },
  systemSuperActor,
);
assert.equal(admin.user.phone, null);
assert.equal(admin.user.position, null);
const superAdminActor = {
  email: admin.user.email,
  id: admin.user.id,
  name: admin.user.name,
  roles: [RoleCode.SUPER_ADMIN],
  status: UserStatus.ACTIVE,
};

const legacySecretariaId = "legacy-secretaria";
prisma.users.push({
  id: legacySecretariaId,
  name: "Secretaria Legado",
  email: "secretaria@example.com",
  phone: null,
  position: null,
  permissionProfileId: null,
  passwordHash: await bcrypt.hash("Senha#26", 4),
  status: UserStatus.ACTIVE,
  mustChangePassword: false,
  passwordChangedAt: null,
  blockedAt: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
prisma.userRoles.push({ userId: legacySecretariaId, roleId: "role-secretaria" });

const legacySecretaria = await service.updateAdminUser(
  legacySecretariaId,
  {
    phone: "(44) 98888-7777",
    position: "Secretaria",
    role: RoleCode.SECRETARIA,
  },
  superAdminActor,
);
assert.deepEqual(legacySecretaria.roles, [RoleCode.SECRETARIA]);
assert.equal(legacySecretaria.phone, "44988887777");
assert.equal(legacySecretaria.position, "Secretaria");

const legacyAdministrator = await service.createAdminUser(
  {
    email: "legacy-administrator@example.com",
    institutionIds: [],
    name: "Legacy Administrator",
    role: RoleCode.ADMINISTRATOR,
  },
  systemSuperActor,
);
const legacyAdminAuditCount = prisma.audits.length;
const convertedLegacyUser = await service.updateAdminUser(
  legacyAdministrator.user.id,
  {
    institutionIds: [prisma.institutions[0]!.id],
    permissionProfileId: prisma.permissionProfiles[0]!.id,
    role: RoleCode.USER,
  },
  superAdminActor,
);
assert.deepEqual(convertedLegacyUser.roles, [RoleCode.USER]);
assert.equal(convertedLegacyUser.permissionProfileId, prisma.permissionProfiles[0]!.id);
assert.deepEqual(convertedLegacyUser.institutionIds, [prisma.institutions[0]!.id]);
assert.equal(convertedLegacyUser.effectivePermissions.globalAccess, false);
assert.equal(convertedLegacyUser.effectivePermissions.institutionScope, "restricted");
assert.equal(
  prisma.audits
    .slice(legacyAdminAuditCount)
    .some(
      (audit) =>
        audit.eventType === AdministrativeAuditEventType.USER_ROLE_CHANGED &&
        JSON.stringify(audit.metadata).includes("institutionIdsAfter"),
    ),
  true,
);
const convertedAuthUser = await service.withOperationalCapabilities({
  email: convertedLegacyUser.email,
  id: convertedLegacyUser.id,
  institutionIds: convertedLegacyUser.institutionIds,
  name: convertedLegacyUser.name,
  permissionProfileId: convertedLegacyUser.permissionProfileId,
  roles: [RoleCode.USER],
  status: convertedLegacyUser.status,
});
assert.deepEqual(convertedAuthUser.capabilities, [
  "officialDocuments.view",
  "officialDocuments.issue",
]);

const administratorWithoutProfile = await service.createAdminUser(
  {
    email: "administrator-without-profile@example.com",
    institutionIds: [],
    name: "Administrator Without Profile",
    role: RoleCode.ADMINISTRATOR,
  },
  systemSuperActor,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      { institutionIds: [prisma.institutions[0]!.id], role: RoleCode.USER },
      superAdminActor,
    ),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      {
        institutionIds: [],
        permissionProfileId: prisma.permissionProfiles[0]!.id,
        role: RoleCode.USER,
      },
      superAdminActor,
    ),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      {
        institutionIds: [prisma.institutions[0]!.id],
        permissionProfileId: prisma.permissionProfiles[1]!.id,
        role: RoleCode.USER,
      },
      superAdminActor,
    ),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      {
        institutionIds: ["missing"],
        permissionProfileId: prisma.permissionProfiles[0]!.id,
        role: RoleCode.USER,
      },
      superAdminActor,
    ),
  (error) => error instanceof BadRequestException,
);
const administratorAfterRejectedConversion = await service.getAdminUser(
  administratorWithoutProfile.user.id,
);
assert.deepEqual(administratorAfterRejectedConversion.roles, [RoleCode.ADMINISTRATOR]);
assert.equal(administratorAfterRejectedConversion.permissionProfileId, null);
assert.deepEqual(administratorAfterRejectedConversion.institutionIds, []);

const reverseUser = await service.createAdminUser(
  {
    email: "reverse-user@example.com",
    institutionIds: [prisma.institutions[0]!.id],
    name: "Reverse User",
    permissionProfileId: prisma.permissionProfiles[0]!.id,
    role: RoleCode.USER,
  },
  systemSuperActor,
);
const promotedAdministrator = await service.updateAdminUser(
  reverseUser.user.id,
  {
    institutionIds: reverseUser.user.institutionIds,
    role: RoleCode.ADMINISTRATOR,
  },
  superAdminActor,
);
assert.deepEqual(promotedAdministrator.roles, [RoleCode.ADMINISTRATOR]);
assert.equal(promotedAdministrator.permissionProfileId, null);
assert.deepEqual(promotedAdministrator.institutionIds, reverseUser.user.institutionIds);
assert.equal(promotedAdministrator.effectivePermissions.globalAccess, false);
assert.equal(promotedAdministrator.effectivePermissions.institutionScope, "restricted");

const promotedSuperAdmin = await service.updateAdminUser(
  promotedAdministrator.id,
  {
    institutionIds: promotedAdministrator.institutionIds,
    role: RoleCode.SUPER_ADMIN,
  },
  superAdminActor,
);
assert.deepEqual(promotedSuperAdmin.roles, [RoleCode.SUPER_ADMIN]);
assert.equal(promotedSuperAdmin.permissionProfileId, null);
assert.equal(promotedSuperAdmin.effectivePermissions.globalAccess, true);

await assert.rejects(
  () =>
    service.updateAdminUser(
      admin.user.id,
      { role: RoleCode.USER },
      systemSuperActor,
    ),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      created.user.id,
      { permissionProfileId: prisma.permissionProfiles[1]!.id, role: RoleCode.USER },
      superAdminActor,
    ),
  (error) => error instanceof BadRequestException,
);

const inactiveAdministrator = await service.updateAdminUser(
  administrator.user.id,
  { status: UserStatus.INACTIVE },
  superAdminActor,
);
assert.equal(inactiveAdministrator.status, UserStatus.INACTIVE);

const administratorActor = {
  email: administrator.user.email,
  id: administrator.user.id,
  name: administrator.user.name,
  roles: [RoleCode.ADMINISTRATOR],
  status: UserStatus.ACTIVE,
};
const administratorManagedUser = await service.createAdminUser(
  {
    email: "administrator-managed-user@example.com",
    institutionIds: [prisma.institutions[0]!.id],
    name: "Managed User",
    permissionProfileId: prisma.permissionProfiles[0]!.id,
    role: RoleCode.USER,
  },
  administratorActor,
);
assert.deepEqual(administratorManagedUser.user.roles, [RoleCode.USER]);
await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "administrator-created-admin@example.com",
        institutionIds: [],
        name: "Created Admin",
        role: RoleCode.ADMINISTRATOR,
      },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "administrator-created-super@example.com",
        institutionIds: [],
        name: "Created Super",
        role: RoleCode.SUPER_ADMIN,
      },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "administrator-created-secretaria@example.com",
        institutionIds: [],
        name: "Created Secretaria",
        role: RoleCode.SECRETARIA,
      },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.createAdminUser(
      {
        email: "administrator-created-gestor@example.com",
        institutionIds: [],
        name: "Created Gestor",
        role: RoleCode.GESTOR,
      },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
const administratorUpdatedUser = await service.updateAdminUser(
  administratorManagedUser.user.id,
  {
    institutionIds: [prisma.institutions[1]!.id],
    name: "Managed User Updated",
    permissionProfileId: prisma.permissionProfiles[0]!.id,
    role: RoleCode.USER,
    status: UserStatus.INACTIVE,
  },
  administratorActor,
);
assert.equal(administratorUpdatedUser.name, "Managed User Updated");
assert.equal(administratorUpdatedUser.status, UserStatus.INACTIVE);
assert.deepEqual(administratorUpdatedUser.institutionIds, [
  prisma.institutions[1]!.id,
]);
const administratorUserReset = await service.resetAdminUserTemporaryPassword(
  administratorManagedUser.user.id,
  administratorActor,
);
assert.equal(administratorUserReset.user.mustChangePassword, true);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorManagedUser.user.id,
      { role: RoleCode.ADMINISTRATOR },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorManagedUser.user.id,
      { role: RoleCode.SUPER_ADMIN },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorManagedUser.user.id,
      { role: RoleCode.SECRETARIA },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorManagedUser.user.id,
      { role: RoleCode.GESTOR },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.updateAdminUser(admin.user.id, { name: "Blocked" }, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      { status: UserStatus.INACTIVE },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
const administratorUpdatedAdministrator = await service.updateAdminUser(
  administratorWithoutProfile.user.id,
  {
    email: "administrator-without-profile-updated@example.com",
    name: "Administrator Without Profile Updated",
    phone: "(44) 97777-6666",
    position: "Coordenacao administrativa",
    role: RoleCode.ADMINISTRATOR,
  },
  administratorActor,
);
assert.equal(
  administratorUpdatedAdministrator.name,
  "Administrator Without Profile Updated",
);
assert.equal(
  administratorUpdatedAdministrator.email,
  "administrator-without-profile-updated@example.com",
);
assert.equal(administratorUpdatedAdministrator.phone, "44977776666");
assert.equal(
  administratorUpdatedAdministrator.position,
  "Coordenacao administrativa",
);
assert.deepEqual(administratorUpdatedAdministrator.roles, [RoleCode.ADMINISTRATOR]);
const administratorPasswordReset =
  await service.resetAdminUserTemporaryPassword(
    administratorWithoutProfile.user.id,
    administratorActor,
  );
assert.equal(administratorPasswordReset.user.mustChangePassword, true);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      { role: RoleCode.SUPER_ADMIN },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      { role: RoleCode.USER },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.blockAdminUser(admin.user.id, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.unblockAdminUser(admin.user.id, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.resetAdminUserTemporaryPassword(admin.user.id, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.getAdminUser(admin.user.id, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.blockAdminUser(administratorWithoutProfile.user.id, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.unblockAdminUser(administratorWithoutProfile.user.id, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      administratorWithoutProfile.user.id,
      { institutionIds: [prisma.institutions[0]!.id] },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUserInstitutions(
      administratorWithoutProfile.user.id,
      [prisma.institutions[0]!.id],
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () =>
    service.updateAdminUser(
      legacySecretariaId,
      { status: UserStatus.INACTIVE },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
const legacyGestorId = "legacy-gestor";
prisma.users.push({
  id: legacyGestorId,
  name: "Gestor Legado",
  email: "gestor-legado@example.com",
  phone: null,
  position: null,
  permissionProfileId: null,
  passwordHash: await bcrypt.hash("Senha#26", 4),
  status: UserStatus.ACTIVE,
  mustChangePassword: false,
  passwordChangedAt: null,
  blockedAt: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
prisma.userRoles.push({ userId: legacyGestorId, roleId: "role-gestor" });
await assert.rejects(
  () =>
    service.updateAdminUser(
      legacyGestorId,
      { status: UserStatus.INACTIVE },
      administratorActor,
    ),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.resetAdminUserTemporaryPassword(legacySecretariaId, administratorActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.resetAdminUserTemporaryPassword(legacyGestorId, administratorActor),
  (error) => error instanceof ForbiddenException,
);

const list = await service.listAdminUsers({
  limit: 10,
  mustChangePassword: true,
  order: SortOrder.ASC,
  page: 1,
  search: "admin@example.com",
  sort: AdminUserSort.NAME,
});
assert.equal(list.data.length, 1);
assert.equal(list.pagination.total, 1);
assert.doesNotMatch(JSON.stringify(list), /passwordHash|temporaryPassword/);

const administratorScopedList = await service.listAdminUsers(
  {
    limit: 100,
    order: SortOrder.ASC,
    page: 1,
    sort: AdminUserSort.NAME,
  },
  administratorActor,
);
assert.equal(
  administratorScopedList.data.some((user) =>
    user.roles.includes(RoleCode.SUPER_ADMIN),
  ),
  false,
);
assert.equal(
  administratorScopedList.data.some((user) =>
    user.roles.includes(RoleCode.ADMINISTRATOR),
  ),
  true,
);
assert.equal(
  administratorScopedList.pagination.total,
  administratorScopedList.data.length,
);
const administratorScopedSuperFilter = await service.listAdminUsers(
  {
    limit: 10,
    order: SortOrder.ASC,
    page: 1,
    role: RoleCode.SUPER_ADMIN,
    sort: AdminUserSort.NAME,
  },
  administratorActor,
);
assert.equal(administratorScopedSuperFilter.data.length, 0);
assert.equal(administratorScopedSuperFilter.pagination.total, 0);
const administratorScopedSearch = await service.listAdminUsers(
  {
    limit: 10,
    order: SortOrder.ASC,
    page: 1,
    search: admin.user.email,
    sort: AdminUserSort.NAME,
  },
  administratorActor,
);
assert.equal(administratorScopedSearch.data.length, 0);

const administratorVisibleAdministrator = await service.getAdminUser(
  administratorWithoutProfile.user.id,
  administratorActor,
);
assert.deepEqual(administratorVisibleAdministrator.roles, [RoleCode.ADMINISTRATOR]);

await assert.rejects(
  () => service.updateAdminUser(admin.user.id, { role: RoleCode.SECRETARIA }, superAdminActor),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () => service.blockAdminUser(admin.user.id, superAdminActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.updateAdminUserInstitutions(created.user.id, ["missing"], superAdminActor),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () => service.updateAdminUserInstitutions(admin.user.id, [], superAdminActor),
  (error) => error instanceof ForbiddenException,
);
await assert.rejects(
  () => service.updateAdminUserInstitutions(created.user.id, [], superAdminActor),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () => service.resetAdminUserTemporaryPassword(admin.user.id, superAdminActor),
  (error) => error instanceof ForbiddenException,
);

const blocked = await service.blockAdminUser(created.user.id, superAdminActor);
assert.equal(blocked.status, UserStatus.INACTIVE);
assert.ok(blocked.blockedAt);
assert.equal(blocked.mustChangePassword, true);
assert.equal(
  prisma.users.find((user) => user.id === created.user.id)?.passwordChangedAt?.getTime(),
  blocked.blockedAt?.getTime(),
);

const unblocked = await service.unblockAdminUser(created.user.id, superAdminActor);
assert.equal(unblocked.status, UserStatus.ACTIVE);
assert.equal(unblocked.blockedAt, null);
assert.equal(unblocked.mustChangePassword, true);

const userBeforeFailedAudit = {
  ...prisma.users.find((user) => user.id === created.user.id)!,
};
const auditCountBeforeFailedAudit = prisma.audits.length;
prisma.failAudit = true;
await assert.rejects(
  () => service.blockAdminUser(created.user.id, superAdminActor),
  /audit failure/,
);
prisma.failAudit = false;
assert.deepEqual(
  prisma.users.find((user) => user.id === created.user.id),
  userBeforeFailedAudit,
);
assert.equal(prisma.audits.length, auditCountBeforeFailedAudit);

const reset = await service.resetAdminUserTemporaryPassword(created.user.id, superAdminActor);
assert.equal(reset.user.mustChangePassword, true);
assert.ok(prisma.users.find((user) => user.id === created.user.id)?.passwordChangedAt);
assert.equal(JSON.stringify(prisma.audits).includes(reset.temporaryPassword), false);

await assert.rejects(
  () =>
    service.changeOwnPassword(
      created.user.id,
      {
        currentPassword: "senha-incorreta",
        newPassword: "NovaSenha#2026",
        confirmPassword: "NovaSenha#2026",
      },
      { ip: "127.0.0.1", userAgent: "Tests" },
    ),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () =>
    service.changeOwnPassword(
      created.user.id,
      {
        currentPassword: reset.temporaryPassword,
        newPassword: "fraca",
        confirmPassword: "fraca",
      },
      { ip: "127.0.0.1", userAgent: "Tests" },
    ),
  (error) => error instanceof BadRequestException,
);
await assert.rejects(
  () =>
    service.changeOwnPassword(
      created.user.id,
      {
        currentPassword: reset.temporaryPassword,
        newPassword: "NovaSenha#2026",
        confirmPassword: "OutraSenha#2026",
      },
      { ip: "127.0.0.1", userAgent: "Tests" },
    ),
  (error) => error instanceof BadRequestException,
);

const ownPasswordChange = await service.changeOwnPassword(
  created.user.id,
  {
    currentPassword: reset.temporaryPassword,
    newPassword: "NovaSenha#2026",
    confirmPassword: "NovaSenha#2026",
  },
  { ip: "127.0.0.1", userAgent: "Tests" },
);
assert.equal(ownPasswordChange.ok, true);
assert.equal(ownPasswordChange.requiresLogin, true);
const changedUser = prisma.users.find((user) => user.id === created.user.id)!;
assert.equal(changedUser.mustChangePassword, false);
assert.equal(await bcrypt.compare("NovaSenha#2026", changedUser.passwordHash), true);
assert.doesNotMatch(JSON.stringify(prisma.audits), /NovaSenha#2026|passwordHash/);

const voluntaryPasswordChange = await service.changeOwnPassword(
  created.user.id,
  {
    currentPassword: "NovaSenha#2026",
    newPassword: "OutraSenha#2026",
    confirmPassword: "OutraSenha#2026",
  },
  { ip: "127.0.0.1", userAgent: "Tests" },
);
assert.equal(voluntaryPasswordChange.ok, true);
assert.equal(
  prisma.audits.some(
    (audit) =>
      audit.eventType ===
      AdministrativeAuditEventType.USER_FIRST_ACCESS_PASSWORD_CHANGED,
  ),
  true,
);
assert.equal(
  prisma.audits.some(
    (audit) => audit.eventType === AdministrativeAuditEventType.USER_PASSWORD_CHANGED,
  ),
  true,
);
assert.equal(
  prisma.audits.some(
    (audit) => audit.eventType === AdministrativeAuditEventType.USER_STATUS_CHANGED,
  ),
  true,
);

const account = await service.updateOwnAccount(created.user.id, {
  name: "Novo Nome",
});
assert.equal(account.user.name, "Novo Nome");
assert.equal(account.user.email, created.user.email);
assert.equal(account.user.roles.includes(RoleCode.USER), true);
