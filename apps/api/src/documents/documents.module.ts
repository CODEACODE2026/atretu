import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AppConfigModule } from "../config/app-config.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { UsersModule } from "../users/users.module.js";
import { DocumentStorageService } from "./document-storage.service.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AppConfigModule,
    AuthModule,
    DatabaseModule,
    UsersModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentStorageService, DocumentsService],
})
export class DocumentsModule {}
