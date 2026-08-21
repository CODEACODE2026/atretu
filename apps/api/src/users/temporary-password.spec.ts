import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { assertPasswordPolicy } from "./password-policy.js";
import { generateTemporaryPassword } from "./temporary-password.js";

const password = generateTemporaryPassword();

assert.equal(password.length, 16);
assert.match(password, /[A-Z]/);
assert.match(password, /[a-z]/);
assert.match(password, /\d/);
assert.match(password, /[!@#$%*\-_+=]/);
assert.notEqual(password, generateTemporaryPassword());

assert.throws(() => generateTemporaryPassword(7));
assert.doesNotThrow(() => generateTemporaryPassword(8));

assert.doesNotThrow(() =>
  assertPasswordPolicy({
    password: "Senha#26",
    currentPassword: "SenhaAntiga#2025",
    email: "usuario@example.com",
    name: "Usuario Teste",
  }),
);
assert.throws(
  () => assertPasswordPolicy({ password: "fraca" }),
  (error) => error instanceof BadRequestException,
);
assert.throws(
  () => assertPasswordPolicy({ password: "Aa1!aaa" }),
  (error) => error instanceof BadRequestException,
);
assert.throws(
  () =>
    assertPasswordPolicy({
      password: "Senha#26",
      currentPassword: "Senha#26",
    }),
  (error) => error instanceof BadRequestException,
);
