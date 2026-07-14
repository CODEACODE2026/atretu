import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { UsersModule } from "../users/users.module.js";
import { StudentCardPdfService } from "./student-card-pdf.service.js";
import { StudentCardsController } from "./student-cards.controller.js";
import { StudentCardsService } from "./student-cards.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AuthModule,
    DatabaseModule,
    DocumentsModule,
    UsersModule,
  ],
  controllers: [StudentCardsController],
  providers: [StudentCardsService, StudentCardPdfService],
  exports: [StudentCardsService],
})
export class StudentCardsModule {}
