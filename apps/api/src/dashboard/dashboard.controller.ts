import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { DashboardService } from "./dashboard.service.js";
import { DashboardOverviewQueryDto } from "./dto/dashboard.dto.js";

@UseGuards(AuthGuard, RolesGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get("overview")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  overview(
    @Query() query: DashboardOverviewQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboard.getOverview(query, user);
  }
}
