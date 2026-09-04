import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import {
  OperationalRateLimit,
  OperationalRateLimitGuard,
  RATE_LIMITS,
} from "../security/operational-rate-limit.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { DashboardService } from "./dashboard.service.js";
import { DashboardOverviewQueryDto } from "./dto/dashboard.dto.js";

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

  @Get("overview")
  @OperationalPermission("dashboard.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  overview(
    @Query() query: DashboardOverviewQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboard.getOverview(query, user);
  }
}
