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

assert.throws(() => generateTemporaryPassword(8));

assert.doesNotThrow(() =>
  assertPasswordPolicy({
    password: "SenhaForte#2026",
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
  () =>
    assertPasswordPolicy({
      password: "SenhaForte#2026",
      currentPassword: "SenhaForte#2026",
    }),
  (error) => error instanceof BadRequestException,
);
