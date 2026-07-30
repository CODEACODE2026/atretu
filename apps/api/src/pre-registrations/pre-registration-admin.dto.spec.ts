import "reflect-metadata";
import assert from "node:assert/strict";
import { PreRegistrationStatus } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListPreRegistrationsDto } from "./dto/pre-registration-admin.dto.js";

async function errorsFor(payload: Record<string, unknown>) {
  return validate(plainToInstance(ListPreRegistrationsDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

assert.equal((await errorsFor({ status: PreRegistrationStatus.PENDING })).length, 0);
assert.equal((await errorsFor({ status: "all" })).length, 0);
assert.equal((await errorsFor({ status: "INVALID" })).length, 1);
assert.equal(
  (
    await errorsFor({
      academicYearId: "11111111-1111-4111-8111-111111111111",
      institutionId: "22222222-2222-4222-8222-222222222222",
      status: "all",
    })
  ).length,
  0,
);
