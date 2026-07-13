import "reflect-metadata";
import assert from "node:assert/strict";
import { BaseRecordsController } from "../src/base-records/base-records.controller.ts";
import { PreRegistrationsController } from "../src/pre-registrations/pre-registrations.controller.ts";
import { StudentsController } from "../src/students/students.controller.ts";

const checks = [
  {
    controller: BaseRecordsController,
    method: "createBus",
    expected: "CreateBusDto",
  },
  {
    controller: StudentsController,
    method: "createStudent",
    expected: "CreateStudentDto",
  },
  {
    controller: PreRegistrationsController,
    method: "createPublicPreRegistration",
    expected: "CreatePublicPreRegistrationDto",
  },
];

for (const check of checks) {
  const paramTypes =
    Reflect.getMetadata("design:paramtypes", check.controller.prototype, check.method) ?? [];
  const typeNames = paramTypes.map((type) => type?.name);

  assert.equal(
    typeNames[0],
    check.expected,
    `${check.method} must preserve ${check.expected} runtime metadata`,
  );
}

console.log("Controller DTO metadata OK");
