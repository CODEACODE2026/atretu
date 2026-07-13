import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { BusAssignmentsModule } from "../bus-assignments/bus-assignments.module.js";
import { AppConfigModule } from "../config/app-config.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { SecurityModule } from "../security/security.module.js";
import { StudentCardsModule } from "../student-cards/student-cards.module.js";
import { UsersModule } from "../users/users.module.js";
import { PreRegistrationsController } from "./pre-registrations.controller.js";
import { PreRegistrationsService } from "./pre-registrations.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AuthModule,
    BusAssignmentsModule,
    AppConfigModule,
    DatabaseModule,
    DocumentsModule,
    SecurityModule,
    StudentCardsModule,
    UsersModule,
  ],
  controllers: [PreRegistrationsController],
  providers: [PreRegistrationsService],
  exports: [PreRegistrationsService],
})
export class PreRegistrationsModule {}
