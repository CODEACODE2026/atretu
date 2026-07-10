import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module.js";
import { BaseRecordsModule } from "./base-records/base-records.module.js";
import { BusAssignmentsModule } from "./bus-assignments/bus-assignments.module.js";
import { HttpErrorFilter } from "./common/http-exception.filter.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health.controller.js";
import { StudentsModule } from "./students/students.module.js";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    BaseRecordsModule,
    BusAssignmentsModule,
    StudentsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpErrorFilter,
    },
  ],
})
export class AppModule {}
