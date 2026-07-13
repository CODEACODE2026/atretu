import { Module } from "@nestjs/common";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { BusAssignmentsModule } from "../bus-assignments/bus-assignments.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { StudentCardsModule } from "../student-cards/student-cards.module.js";
import { UsersModule } from "../users/users.module.js";
import { StudentsController } from "./students.controller.js";
import { StudentsService } from "./students.service.js";

@Module({
  imports: [
    AdministrativeAuditModule,
    AuthModule,
    BusAssignmentsModule,
    DatabaseModule,
    StudentCardsModule,
    UsersModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
