import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AppConfigModule } from "../config/app-config.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { SecurityModule } from "../security/security.module.js";
import { PreRegistrationsController } from "./pre-registrations.controller.js";
import { PreRegistrationsService } from "./pre-registrations.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AppConfigModule,
    DatabaseModule,
    DocumentsModule,
    SecurityModule,
  ],
  controllers: [PreRegistrationsController],
  providers: [PreRegistrationsService],
  exports: [PreRegistrationsService],
})
export class PreRegistrationsModule {}
