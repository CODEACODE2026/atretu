import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { UsersModule } from "../users/users.module.js";
import { BusAssignmentsController } from "./bus-assignments.controller.js";
import { BusAssignmentsService } from "./bus-assignments.service.js";

@Module({
  imports: [AuthModule, DatabaseModule, UsersModule],
  controllers: [BusAssignmentsController],
  providers: [BusAssignmentsService],
  exports: [BusAssignmentsService],
})
export class BusAssignmentsModule {}
