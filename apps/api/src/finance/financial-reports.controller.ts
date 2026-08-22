import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { FinancialMonthlyReportDto } from "./dto/financial-reports.dto.js";
import { FinancialReportsService } from "./financial-reports.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Controller("finance/reports")
export class FinancialReportsController {
  constructor(
    @Inject(FinancialReportsService)
    private readonly reports: FinancialReportsService,
  ) {}

  @Get("monthly")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  monthly(@Query() query: FinancialMonthlyReportDto) {
    return this.reports.monthly(query);
  }
}
