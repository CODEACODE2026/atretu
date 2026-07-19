import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { UsersModule } from "../users/users.module.js";
import { JobMonitorService } from "./job-monitor.service.js";
import { JobsController } from "./jobs.controller.js";

@Global()
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [JobsController],
  providers: [JobMonitorService],
  exports: [JobMonitorService],
})
export class JobsModule {}
