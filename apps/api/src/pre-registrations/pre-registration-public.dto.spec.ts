import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreatePublicPreRegistrationDto } from "./dto/pre-registration-public.dto.js";

const validPayload = {
  fullName: "Interessado Atretu",
  cpf: "123.456.789-09",
  rg: "123456",
  birthDate: "2001-05-12",
  phone: "49999999999",
  email: "interessado@example.com",
  addressStreet: "Rua Central",
  addressNumber: "123",
  addressNeighborhood: "Centro",
  addressCity: "Terra Rica",
  guardianFullName: "Responsavel Atretu",
  guardianCpf: "987.654.321-00",
  guardianRg: "654321",
  academicYearId: "11111111-1111-4111-8111-111111111111",
  institutionId: "22222222-2222-4222-8222-222222222222",
  shiftId: "33333333-3333-4333-8333-333333333333",
  course: "Tecnico em Administracao",
  grade: "1o",
};

async function errorsFor(payload: Record<string, unknown>) {
  return validate(plainToInstance(CreatePublicPreRegistrationDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

assert.equal((await errorsFor(validPayload)).length, 0);
assert.equal((await errorsFor({ ...validPayload, email: "invalido" })).length, 1);
assert.equal((await errorsFor({ ...validPayload, academicYearId: "abc" })).length, 1);
assert.equal((await errorsFor({ ...validPayload, addressCity: "" })).length, 1);
assert.equal(
  (await errorsFor({ ...validPayload, website: "filled-by-bot" })).length,
  0,
);
