import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { JobMonitorService } from "./job-monitor.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN)
@Controller("admin/jobs")
export class JobsController {
  constructor(
    @Inject(JobMonitorService) private readonly jobs: JobMonitorService,
  ) {}

  @Get("status")
  status() {
    return this.jobs.getStatus();
  }
}
