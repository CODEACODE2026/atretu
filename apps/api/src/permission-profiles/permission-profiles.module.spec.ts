import assert from "node:assert/strict";
import { NestFactory } from "@nestjs/core";
import { PermissionProfilesModule } from "./permission-profiles.module.js";

const app = await NestFactory.createApplicationContext(PermissionProfilesModule, {
  logger: false,
});

try {
  assert.ok(app.get(PermissionProfilesModule));
} finally {
  await app.close();
}

console.log("Permission profiles module bootstrap OK");
