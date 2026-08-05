import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AppConfigModule } from "../config/app-config.module.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [AdministrativeAuditModule, AppConfigModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
