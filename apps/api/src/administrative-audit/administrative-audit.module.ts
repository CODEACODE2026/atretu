import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AdministrativeAuditService } from "./administrative-audit.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [AdministrativeAuditService],
  exports: [AdministrativeAuditService],
})
export class AdministrativeAuditModule {}
