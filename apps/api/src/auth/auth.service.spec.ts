import assert from "node:assert/strict";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service.js";

const config = {
  values: {
    passwordHashRounds: 4,
    jwtSecret: "test-secret-with-enough-length",
    jwtExpiresIn: "2h",
  },
};

const usersService = {
  findByEmailWithPassword: async () => null,
  markLogin: async () => undefined,
  toAuthUser: (user: unknown) => user,
  countSuperAdmins: async () => 0,
  createUserWithRole: async () => ({
    id: "user-id",
    name: "Admin",
    email: "admin@example.com",
    status: "ACTIVE",
    roles: ["SUPER_ADMIN"],
  }),
};

const authService = new AuthService(
  config as never,
  new JwtService({
    secret: config.values.jwtSecret,
    signOptions: {
      expiresIn: config.values.jwtExpiresIn as JwtSignOptions["expiresIn"],
    },
  }),
  usersService as never,
);

const hash = await authService.hashPassword("SenhaForte123");
assert.equal(await bcrypt.compare("SenhaForte123", hash), true);
assert.equal(await authService.verifyPassword("SenhaForte123", hash), true);
assert.equal(await authService.verifyPassword("SenhaErrada", hash), false);

const user = await authService.createFirstSuperAdmin({
  name: "Admin",
  email: "admin@example.com",
  password: "SenhaForte123",
});
const token = await authService.signToken(user);
const payload = await authService.verifyToken(token);
assert.equal(payload.sub, "user-id");
assert.deepEqual(payload.roles, ["SUPER_ADMIN"]);
