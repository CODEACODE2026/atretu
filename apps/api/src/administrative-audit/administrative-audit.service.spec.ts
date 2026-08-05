import assert from "node:assert/strict";
import { AdministrativeAuditEventType } from "@prisma/client";
import {
  AdministrativeAuditService,
  sanitizeAdministrativeAuditMetadata,
} from "./administrative-audit.service.js";

const metadata = sanitizeAdministrativeAuditMetadata({
  changedFields: ["name", "password"],
  currentPassword: "secret",
  nested: {
    Password: "secret",
    keep: "ok",
    values: [
      { temporary_password: "secret", after: "safe" },
      { Authorization: "Bearer token", statusAfter: "ACTIVE" },
      { "Set-Cookie": "atretu_session=secret" },
    ],
  },
  authorizationHeader: "Bearer token",
  password_hash: "hash",
  token: "jwt",
});

const serialized = JSON.stringify(metadata);
assert.equal(serialized.includes("secret"), false);
assert.equal(serialized.includes("hash"), false);
assert.equal(serialized.includes("Bearer token"), false);
assert.equal(serialized.includes("jwt"), false);
assert.equal((metadata?.nested as { keep?: string }).keep, "ok");

const writes: unknown[] = [];
const service = new AdministrativeAuditService({
  administrativeAuditLog: {
    create: async ({ data }: { data: unknown }) => {
      writes.push(data);
      return data;
    },
  },
} as never);

await service.record({
  eventType: AdministrativeAuditEventType.USER_UPDATED,
  userId: "actor-1",
  domain: "users",
  recordId: "user-1",
  metadata: {
    newPassword: "secret",
    after: { name: "Usuario" },
  },
});

assert.equal(JSON.stringify(writes).includes("secret"), false);
assert.equal(JSON.stringify(writes).includes("Usuario"), true);
