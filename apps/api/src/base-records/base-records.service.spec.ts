import assert from "node:assert/strict";
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

type Row = {
  id: string;
  name: string;
  normalizedName: string;
  status: RecordStatus;
  capacity?: number;
};

function createDelegate() {
  const rows: Row[] = [];
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
    delegate: {
      async findMany({ where }: { where: Partial<Row> & { name?: unknown } }) {
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
