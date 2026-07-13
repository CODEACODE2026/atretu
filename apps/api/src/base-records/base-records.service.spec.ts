import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import {
  AdministrativeAuditEventType,
  RecordStatus,
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

function createDelegate() {
  const rows: Row[] = [];
  let lastFindManyArgs: Record<string, unknown> | undefined;
  let nextId = 1;
  const filterRows = (where: Partial<Row> & { name?: unknown }) =>
    rows.filter((row) => {
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
    rows,
    get lastFindManyArgs() {
      return lastFindManyArgs;
    },
    delegate: {
      async findMany(args: {
        where: Partial<Row> & { name?: unknown };
        skip?: number;
        take?: number;
      }) {
        lastFindManyArgs = args;
        const { where } = args;
        return filterRows(where);
      },
      async count({ where }: { where: Partial<Row> }) {
        return filterRows(where).length;
      },
      async findUnique({ where }: { where: { id: string } }) {
        return rows.find((row) => row.id === where.id) ?? null;
      },
      async create({ data }: { data: Row }) {
        if (
          rows.some((row) => row.normalizedName === data.normalizedName)
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
        rows.push(record);
        return record;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<Row> }) {
        const index = rows.findIndex((row) => row.id === where.id);
        assert.notEqual(index, -1);
        const current = rows[index]!;
        if (
          data.normalizedName &&
          rows.some(
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

        rows[index] = { ...current, ...data };
        return rows[index];
      },
    },
  };
}

const institutions = createDelegate();
const auditEvents: Array<{
  eventType: AdministrativeAuditEventType;
  domain: string;
}> = [];

const service = new BaseRecordsService(
  {
    institution: institutions.delegate,
    shift: createDelegate().delegate,
    bus: createDelegate().delegate,
  } as never,
  {
    record: async (input: {
      eventType: AdministrativeAuditEventType;
      domain: string;
    }) => {
      auditEvents.push(input);
    },
  } as never,
);

const created = await service.createInstitution(
  { name: " Universidade Central " },
  "user-id",
);

assert.equal(created.name, " Universidade Central ");
assert.equal(created.normalizedName, "universidade central");
assert.equal(auditEvents[0]?.eventType, "BASE_RECORD_CREATED");

const inactive = await service.inactivateInstitution(created.id, "user-id");
assert.equal(inactive.status, RecordStatus.INACTIVE);
assert.equal(auditEvents.at(-1)?.eventType, "BASE_RECORD_INACTIVATED");

const activeList = await service.listInstitutions({
  page: 1,
  limit: 20,
  status: RecordStatusFilter.ACTIVE,
  sort: BaseRecordSort.NAME,
  order: SortOrder.ASC,
});
assert.equal(activeList.data.length, 0);

const allList = await service.listInstitutions({
  page: 1,
  limit: 20,
  status: RecordStatusFilter.ALL,
  sort: BaseRecordSort.NAME,
  order: SortOrder.ASC,
});
assert.equal(allList.data.length, 1);

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
