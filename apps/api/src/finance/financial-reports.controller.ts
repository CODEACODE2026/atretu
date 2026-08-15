import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
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
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  monthly(@Query() query: FinancialMonthlyReportDto) {
    return this.reports.monthly(query);
  }
}
