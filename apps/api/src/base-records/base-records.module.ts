import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { BaseRecordsController } from "./base-records.controller.js";
import { BaseRecordsService } from "./base-records.service.js";

@Module({
  imports: [AdministrativeAuditModule, AuthModule, DatabaseModule],
  controllers: [BaseRecordsController],
  providers: [BaseRecordsService],
})
export class BaseRecordsModule {}
