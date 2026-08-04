import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { RoleCode, UserStatus } from "@prisma/client";
import {
  assertInstitutionInScope,
  getInstitutionScope,
  scopedInstitutionFilter,
  scopedInstitutionIds,
} from "./institution-scope.js";
import type { AuthUser } from "../users/users.service.js";

const secretary: AuthUser = {
  id: "user-1",
  name: "Secretaria",
  email: "secretaria@example.com",
  status: UserStatus.ACTIVE,
  roles: [RoleCode.SECRETARIA],
  institutionIds: ["institution-1", "institution-2"],
};

assert.deepEqual(getInstitutionScope(undefined), { type: "unrestricted" });
assert.deepEqual(
  scopedInstitutionFilter({ ...secretary, roles: [RoleCode.SUPER_ADMIN] }),
  undefined,
);
assert.deepEqual(scopedInstitutionFilter(secretary), {
  in: ["institution-1", "institution-2"],
});
assert.equal(scopedInstitutionFilter(secretary, "institution-1"), "institution-1");
assert.throws(
  () => scopedInstitutionFilter(secretary, "institution-3"),
  ForbiddenException,
);
assert.deepEqual(scopedInstitutionFilter({ ...secretary, institutionIds: [] }), {
  in: [],
});
assert.throws(
  () => scopedInstitutionFilter({ ...secretary, institutionIds: [] }, "institution-1"),
  ForbiddenException,
);
assert.deepEqual(scopedInstitutionIds(secretary), ["institution-1", "institution-2"]);
assert.deepEqual(scopedInstitutionIds({ ...secretary, institutionIds: [] }), []);
assert.equal(scopedInstitutionIds({ ...secretary, roles: [RoleCode.SUPER_ADMIN] }), null);
assert.doesNotThrow(() => assertInstitutionInScope(secretary, "institution-1"));
assert.throws(
  () => assertInstitutionInScope(secretary, "institution-3"),
  ForbiddenException,
);

console.log("Institution scope guard OK");
