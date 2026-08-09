import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { UsersModule } from "../users/users.module.js";
import { AssociationSettingsController } from "./association-settings.controller.js";
import { AssociationSettingsService } from "./association-settings.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AuthModule,
    DatabaseModule,
    DocumentsModule,
    UsersModule,
  ],
  controllers: [AssociationSettingsController],
  providers: [AssociationSettingsService],
  exports: [AssociationSettingsService],
})
export class AssociationSettingsModule {}
