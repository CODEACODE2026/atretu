import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { SecurityModule } from "../security/security.module.js";
import { UsersModule } from "../users/users.module.js";
import { PermissionProfilesController } from "./permission-profiles.controller.js";
import { PermissionProfilesService } from "./permission-profiles.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AuthModule,
    DatabaseModule,
    SecurityModule,
    UsersModule,
  ],
  controllers: [PermissionProfilesController],
  providers: [PermissionProfilesService],
  exports: [PermissionProfilesService],
})
export class PermissionProfilesModule {}
