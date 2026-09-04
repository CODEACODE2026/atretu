import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AssociationSettingsModule } from "../association-settings/association-settings.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { SecurityModule } from "../security/security.module.js";
import { UsersModule } from "../users/users.module.js";
import { OfficialDocumentPdfBuilder } from "./official-document-pdf.builder.js";
import {
  OfficialDocumentModelsController,
  OfficialDocumentIssuesController,
  InstitutionalOfficialDocumentsController,
  OfficialDocumentsController,
} from "./official-documents.controller.js";
import { OfficialDocumentsService } from "./official-documents.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AssociationSettingsModule,
    AuthModule,
    DatabaseModule,
    DocumentsModule,
    SecurityModule,
    UsersModule,
  ],
  controllers: [
    OfficialDocumentModelsController,
    InstitutionalOfficialDocumentsController,
    OfficialDocumentsController,
    OfficialDocumentIssuesController,
  ],
  providers: [OfficialDocumentPdfBuilder, OfficialDocumentsService],
})
export class OfficialDocumentsModule {}
