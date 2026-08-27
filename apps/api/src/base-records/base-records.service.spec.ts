import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  RecordStatus,
  RoleCode,
  UserStatus,
} from "@prisma/client";
import { BaseRecordsService } from "./base-records.service.js";
import {
  BaseRecordSort,
  RecordStatusFilter,
  SortOrder,
} from "./dto/base-record.dto.js";
import { resolvePagination } from "../common/pagination.js";

type Row = {
  id: string;
  name: string;
  normalizedName: string;
  status: RecordStatus;
  capacity?: number;
};

type RowWhere = Omit<Partial<Row>, "id" | "name"> & {
  id?: string | { in: string[] };
  name?: unknown;
};

function createDelegate(initialRows: Row[] = []) {
  const state = {
    rows: [...initialRows],
  };
  let lastFindManyArgs: Record<string, unknown> | undefined;
  let nextId =
    Math.max(0, ...state.rows.map((row) => Number(row.id)).filter(Number.isFinite)) + 1;
  const filterRows = (where: RowWhere) =>
    state.rows.filter((row) => {
      if (typeof where.id === "string" && row.id !== where.id) {
        return false;
      }

      if (
        where.id &&
        typeof where.id === "object" &&
        "in" in where.id &&
        !where.id.in.includes(row.id)
      ) {
        return false;
      }

      if (where.status && row.status !== where.status) {
        return false;
      }

      if (
        where.name &&
        typeof where.name === "object" &&
        "contains" in where.name
      ) {
        const nameFilter = where.name as { contains: string };
        return row.name.toLowerCase().includes(nameFilter.contains.toLowerCase());
      }

      return true;
    });

  return {
    get rows() {
      return state.rows;
    },
    cloneRows() {
      return state.rows.map((row) => ({ ...row }));
    },
    replaceRows(rows: Row[]) {
      state.rows = rows;
      nextId =
        Math.max(0, ...state.rows.map((row) => Number(row.id)).filter(Number.isFinite)) +
        1;
    },
    get lastFindManyArgs() {
      return lastFindManyArgs;
    },
    delegate: {
      async findMany(args: {
        where: RowWhere;
        skip?: number;
        take?: number;
      }) {
        lastFindManyArgs = args;
        const { where } = args;
        return filterRows(where);
      },
      async count({ where }: { where: RowWhere }) {
        return filterRows(where).length;
      },
      async findUnique({ where }: { where: { id: string } }) {
        return state.rows.find((row) => row.id === where.id) ?? null;
      },
      async create({ data }: { data: Row }) {
        if (
          state.rows.some((row) => row.normalizedName === data.normalizedName)
        ) {
          throw Object.assign(new Error("duplicate"), {
            code: "P2002",
            clientVersion: "test",
          });
        }

        const record = {
          ...data,
          id: String(nextId++),
          status: RecordStatus.ACTIVE,
        };
        state.rows.push(record);
        return record;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<Row> }) {
        const index = state.rows.findIndex((row) => row.id === where.id);
        assert.notEqual(index, -1);
        const current = state.rows[index]!;
        if (
          data.normalizedName &&
          state.rows.some(
            (row) =>
              row.id !== where.id &&
              row.normalizedName === data.normalizedName,
          )
        ) {
          throw Object.assign(new Error("duplicate"), {
            code: "P2002",
            clientVersion: "test",
          });
        }

        state.rows[index] = { ...current, ...data };
        return state.rows[index];
      },
    },
  };
}

const institutions = createDelegate();
const shifts = createDelegate();
const buses = createDelegate();
const auditEvents: Array<{
  eventType: AdministrativeAuditEventType;
  domain: string;
  userId?: string;
  recordId: string;
  metadata?: Record<string, unknown>;
}> = [];
let failNextAudit = false;

function createPrismaMock() {
  const auditLog = {
    async create({ data }: { data: (typeof auditEvents)[number] }) {
      if (failNextAudit) {
        failNextAudit = false;
        throw new Error("audit failed");
      }
      auditEvents.push(data);
      return data;
    },
  };
  return {
    institution: institutions.delegate,
    shift: shifts.delegate,
    bus: buses.delegate,
    academicYear: {
      async findFirst() {
        return null;
      },
    },
    busAssignment: {
      async groupBy() {
        return [];
      },
    },
    administrativeAuditLog: auditLog,
    async $queryRaw() {
      return [{ id: "1", count: 0n }];
    },
    async $transaction<T>(callback: (tx: unknown) => Promise<T>) {
      const txInstitutions = createDelegate(institutions.cloneRows());
      const txShifts = createDelegate(shifts.cloneRows());
      const txBuses = createDelegate(buses.cloneRows());
      const txAuditEvents = [...auditEvents];
      const txAuditLog = {
        async create({ data }: { data: (typeof auditEvents)[number] }) {
          if (failNextAudit) {
            failNextAudit = false;
            throw new Error("audit failed");
          }
          txAuditEvents.push(data);
          return data;
        },
      };
      let queryRawCalls = 0;
      const result = await callback({
        institution: txInstitutions.delegate,
        shift: txShifts.delegate,
        bus: txBuses.delegate,
        administrativeAuditLog: txAuditLog,
        async $queryRaw() {
          queryRawCalls += 1;
          return queryRawCalls === 1 ? [{ id: "1" }] : [{ count: 2n }];
        },
        busAssignment: {
          async groupBy() {
            return [{ busId: "1", _count: { _all: 2 } }];
          },
        },
      });
      institutions.replaceRows(txInstitutions.cloneRows());
      shifts.replaceRows(txShifts.cloneRows());
      buses.replaceRows(txBuses.cloneRows());
      auditEvents.splice(0, auditEvents.length, ...txAuditEvents);
      return result;
    },
  };
}

const service = new BaseRecordsService(
  createPrismaMock() as never,
  {
    record: async (input: {
      eventType: AdministrativeAuditEventType;
      domain: string;
      userId?: string;
      recordId: string;
      metadata?: Record<string, unknown>;
    }, tx?: { administrativeAuditLog: { create(args: { data: typeof input }): Promise<unknown> } }) => {
      if (tx) {
        await tx.administrativeAuditLog.create({ data: input });
        return;
      }
      if (failNextAudit) {
        failNextAudit = false;
        throw new Error("audit failed");
      }
      auditEvents.push(input);
    },
  } as never,
);

const created = await service.createInstitution(
  { name: " Universidade Central " },
  "user-id",
);
const superAdminUser = {
  id: "user-id",
  name: "Super Admin",
  email: "admin@example.com",
  status: UserStatus.ACTIVE,
  roles: [RoleCode.SUPER_ADMIN],
  institutionIds: [],
};

assert.equal(created.name, " Universidade Central ");
assert.equal(created.normalizedName, "universidade central");
assert.equal(auditEvents[0]?.eventType, "BASE_RECORD_CREATED");
assert.deepEqual(auditEvents[0]?.metadata, {
  domain: "institutions",
  recordId: created.id,
  after: {
    id: created.id,
    name: " Universidade Central ",
    status: RecordStatus.ACTIVE,
  },
});

const inactive = await service.inactivateInstitution(created.id, superAdminUser);
assert.equal(inactive.status, RecordStatus.INACTIVE);
assert.equal(auditEvents.at(-1)?.eventType, "BASE_RECORD_INACTIVATED");
assert.deepEqual(auditEvents.at(-1)?.metadata, {
  domain: "institutions",
  recordId: created.id,
  before: {
    id: created.id,
    name: " Universidade Central ",
    status: RecordStatus.ACTIVE,
  },
  after: {
    id: created.id,
    name: " Universidade Central ",
    status: RecordStatus.INACTIVE,
  },
  statusBefore: RecordStatus.ACTIVE,
  statusAfter: RecordStatus.INACTIVE,
});

const reactivated = await service.reactivateInstitution(created.id, superAdminUser);
assert.equal(reactivated.status, RecordStatus.ACTIVE);
assert.equal(auditEvents.at(-1)?.eventType, "BASE_RECORD_REACTIVATED");
assert.equal(
  (auditEvents.at(-1)?.metadata as { statusBefore: RecordStatus }).statusBefore,
  RecordStatus.INACTIVE,
);

const updatedInstitution = await service.updateInstitution(
  created.id,
  { name: "Universidade Central Nova" },
  superAdminUser,
);
assert.equal(updatedInstitution.name, "Universidade Central Nova");
assert.deepEqual(auditEvents.at(-1)?.metadata, {
  domain: "institutions",
  recordId: created.id,
  before: {
    id: created.id,
    name: " Universidade Central ",
    status: RecordStatus.ACTIVE,
  },
  after: {
    id: created.id,
    name: "Universidade Central Nova",
    status: RecordStatus.ACTIVE,
  },
  changedFields: ["name"],
});

failNextAudit = true;
await assert.rejects(() =>
  service.updateInstitution(created.id, { name: "Sem audit" }, superAdminUser),
);
assert.equal(
  (await service.getInstitution(created.id, superAdminUser)).name,
  "Universidade Central Nova",
);

failNextAudit = true;
await assert.rejects(() =>
  service.createInstitution({ name: "Rollback Create" }, "user-id"),
);
assert.equal(
  institutions.rows.some((row) => row.normalizedName === "rollback create"),
  false,
);

failNextAudit = true;
await assert.rejects(() => service.inactivateInstitution(created.id, superAdminUser));
assert.equal(
  (await service.getInstitution(created.id, superAdminUser)).status,
  RecordStatus.ACTIVE,
);

const shift = await service.createShift({ name: "Manha" }, "shift-user");
assert.deepEqual(auditEvents.at(-1)?.metadata, {
  domain: "shifts",
  recordId: shift.id,
  after: { id: shift.id, name: "Manha", status: RecordStatus.ACTIVE },
});
await service.updateShift(shift.id, { name: "Tarde" }, "shift-user");
assert.deepEqual(auditEvents.at(-1)?.metadata, {
  domain: "shifts",
  recordId: shift.id,
  before: { id: shift.id, name: "Manha", status: RecordStatus.ACTIVE },
  after: { id: shift.id, name: "Tarde", status: RecordStatus.ACTIVE },
  changedFields: ["name"],
});
await service.inactivateShift(shift.id, "shift-user");
assert.equal(
  (auditEvents.at(-1)?.metadata as { statusAfter: RecordStatus }).statusAfter,
  RecordStatus.INACTIVE,
);
await service.reactivateShift(shift.id, "shift-user");
assert.equal(
  (auditEvents.at(-1)?.metadata as { statusAfter: RecordStatus }).statusAfter,
  RecordStatus.ACTIVE,
);

const bus = await service.createBus({ name: "Onibus 1", capacity: 4 }, "bus-user");
assert.deepEqual(auditEvents.at(-1)?.metadata, {
  domain: "buses",
  recordId: bus.id,
  after: {
    id: bus.id,
    name: "Onibus 1",
    capacity: 4,
    status: RecordStatus.ACTIVE,
  },
});
await service.updateBus(bus.id, { name: "Onibus 2" }, "bus-user");
assert.deepEqual(auditEvents.at(-1)?.metadata, {
  domain: "buses",
  recordId: bus.id,
  before: {
    id: bus.id,
    name: "Onibus 1",
    capacity: 4,
    status: RecordStatus.ACTIVE,
  },
  after: {
    id: bus.id,
    name: "Onibus 2",
    capacity: 4,
    status: RecordStatus.ACTIVE,
  },
  changedFields: ["name"],
});
await service.updateBus(bus.id, { name: "Onibus 2", capacity: 5 }, "bus-user");
assert.equal(auditEvents.at(-1)?.eventType, "BUS_CAPACITY_UPDATED");
assert.deepEqual((auditEvents.at(-1)?.metadata as { changedFields: string[] }).changedFields, [
  "capacity",
]);
await service.updateBus(bus.id, { name: "Onibus 3", capacity: 6 }, "bus-user");
assert.equal(auditEvents.at(-1)?.eventType, "BUS_CAPACITY_UPDATED");
assert.deepEqual((auditEvents.at(-1)?.metadata as { changedFields: string[] }).changedFields, [
  "name",
  "capacity",
]);
await assert.rejects(() => service.updateBus(bus.id, { capacity: 1 }, "bus-user"));
assert.equal((await service.getBus(bus.id)).capacity, 6);
await service.inactivateBus(bus.id, "bus-user");
assert.equal(
  (auditEvents.at(-1)?.metadata as { statusAfter: RecordStatus }).statusAfter,
  RecordStatus.INACTIVE,
);
await service.reactivateBus(bus.id, "bus-user");
assert.equal(
  (auditEvents.at(-1)?.metadata as { statusAfter: RecordStatus }).statusAfter,
  RecordStatus.ACTIVE,
);

const activeList = await service.listInstitutions({
  page: 1,
  limit: 20,
  status: RecordStatusFilter.ACTIVE,
  sort: BaseRecordSort.NAME,
  order: SortOrder.ASC,
});
assert.equal(activeList.data.length, 1);

const allList = await service.listInstitutions({
  page: 1,
  limit: 20,
  status: RecordStatusFilter.ALL,
  sort: BaseRecordSort.NAME,
  order: SortOrder.ASC,
});
assert.equal(allList.data.length, 1);

const institutionA = await service.createInstitution(
  { name: "Instituicao A" },
  "user-id",
);
const institutionB = await service.createInstitution(
  { name: "Instituicao B" },
  "user-id",
);

const userInstitutionList = await service.listInstitutions(
  {
    page: 1,
    limit: 20,
    status: RecordStatusFilter.ACTIVE,
    sort: BaseRecordSort.NAME,
    order: SortOrder.ASC,
  },
  {
    id: "limited-user",
    name: "Limited User",
    email: "limited@example.com",
    status: UserStatus.ACTIVE,
    roles: [RoleCode.USER],
    institutionIds: [institutionA.id],
  },
);
assert.deepEqual(
  userInstitutionList.data.map((institution) => institution.id),
  [institutionA.id],
);

const secretaryUser = {
  ...superAdminUser,
  id: "secretaria-user",
  roles: [RoleCode.SECRETARIA],
  institutionIds: [institutionA.id],
};
const secretariaInstitutionList = await service.listInstitutions(
  {
    page: 1,
    limit: 20,
    status: RecordStatusFilter.ACTIVE,
    sort: BaseRecordSort.NAME,
    order: SortOrder.ASC,
  },
  secretaryUser,
);
assert.deepEqual(
  secretariaInstitutionList.data.map((institution) => institution.id),
  [institutionA.id],
);
assert.equal(
  (await service.getInstitution(institutionA.id, secretaryUser)).id,
  institutionA.id,
);
await assert.rejects(
  () => service.getInstitution(institutionB.id, secretaryUser),
  (error) => error instanceof ForbiddenException,
);

assert.equal(
  (await service.getInstitution(institutionB.id, superAdminUser)).id,
  institutionB.id,
);
assert.equal(
  (
    await service.getInstitution(institutionB.id, {
      ...superAdminUser,
      roles: [RoleCode.ADMINISTRATOR],
    })
  ).id,
  institutionB.id,
);
await assert.rejects(
  () =>
    service.getInstitution(institutionB.id, {
      id: "limited-user",
      name: "Limited User",
      email: "limited@example.com",
      status: UserStatus.ACTIVE,
      roles: [RoleCode.USER],
      institutionIds: [institutionA.id],
    }),
  (error) => error instanceof ForbiddenException,
);

const stringPaginationList = await service.listInstitutions({
  page: "2",
  limit: "10",
  status: RecordStatusFilter.ALL,
  sort: BaseRecordSort.NAME,
  order: SortOrder.ASC,
} as never);
assert.equal(stringPaginationList.pagination.page, 2);
assert.equal(stringPaginationList.pagination.limit, 10);
assert.equal(institutions.lastFindManyArgs?.skip, 10);
assert.equal(institutions.lastFindManyArgs?.take, 10);
assert.equal(typeof institutions.lastFindManyArgs?.skip, "number");
assert.equal(typeof institutions.lastFindManyArgs?.take, "number");

const defaultPaginationList = await service.listInstitutions({
  status: RecordStatusFilter.ALL,
  sort: BaseRecordSort.NAME,
  order: SortOrder.ASC,
} as never);
assert.equal(defaultPaginationList.pagination.page, 1);
assert.equal(defaultPaginationList.pagination.limit, 20);

for (const query of [
  { page: "0", limit: "10" },
  { page: "-1", limit: "10" },
  { page: "abc", limit: "10" },
  { page: "1", limit: "0" },
  { page: "1", limit: "-10" },
  { page: "1", limit: "101" },
  { page: "1", limit: "abc" },
]) {
  await assert.rejects(
    () =>
      service.listInstitutions({
        ...query,
        status: RecordStatusFilter.ALL,
        sort: BaseRecordSort.NAME,
        order: SortOrder.ASC,
      } as never),
    (error) => error instanceof BadRequestException,
  );
}

for (const moduleName of [
  "base-records",
  "students",
  "bus-assignments",
  "pre-registrations",
  "student-cards",
  "finance/invoices",
]) {
  const defaults = resolvePagination({});
  assert.equal(defaults.page, 1, moduleName);
  assert.equal(defaults.limit, 20, moduleName);
  assert.equal(defaults.skip, 0, moduleName);
  const maximum = resolvePagination({ page: "1", limit: "100" });
  assert.equal(maximum.limit, 100, moduleName);
  const numeric = resolvePagination({ page: "2", limit: "10" });
  assert.equal(numeric.page, 2, moduleName);
  assert.equal(numeric.limit, 10, moduleName);
  assert.equal(numeric.skip, 10, moduleName);
  await assert.rejects(
    async () => {
      resolvePagination({ page: "1", limit: "101" });
    },
    (error) => error instanceof BadRequestException,
    moduleName,
  );
}
