import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { StudentCardsController } from "./student-cards.controller.js";
import { StudentCardsService } from "./student-cards.service.js";

@Module({
  imports: [AdministrativeAuditModule, AuthModule, DatabaseModule],
  controllers: [StudentCardsController],
  providers: [StudentCardsService],
  exports: [StudentCardsService],
})
export class StudentCardsModule {}
