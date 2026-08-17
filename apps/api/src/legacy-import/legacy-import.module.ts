import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { UsersModule } from "../users/users.module.js";
import { LegacyImportController } from "./legacy-import.controller.js";
import { LegacyImportService } from "./legacy-import.service.js";

@Module({
  imports: [AdministrativeAuditModule, AuthModule, DatabaseModule, UsersModule],
  controllers: [LegacyImportController],
  providers: [LegacyImportService],
})
export class LegacyImportModule {}

