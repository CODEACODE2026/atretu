import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  AnalyzeLegacyAcademicImportDto,
  AnalyzeLegacyFinancialImportDto,
  ImportLegacyAcademicSelectionDto,
  ImportLegacyFinancialSelectionDto,
} from "./dto/legacy-import.dto.js";
import { LegacyImportService } from "./legacy-import.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN)
@Controller("admin/legacy-import")
export class LegacyImportController {
  constructor(
    @Inject(LegacyImportService)
    private readonly legacyImport: LegacyImportService,
  ) {}

  @Post("academics/analyze")
  analyzeAcademics(@Body() body: AnalyzeLegacyAcademicImportDto) {
    return this.legacyImport.analyzeAcademicImport(body);
  }

  @Post("financial/analyze")
  analyzeFinancial(@Body() body: AnalyzeLegacyFinancialImportDto) {
    return this.legacyImport.analyzeFinancialImport(body);
  }

  @Post("academics/import")
  importAcademics(
    @Body() body: ImportLegacyAcademicSelectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.legacyImport.importAcademicSelection(body, user);
  }

  @Post("financial/import")
  importFinancial(
    @Body() body: ImportLegacyFinancialSelectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.legacyImport.importFinancialSelection(body, user);
  }

  @Post("academics/import-jobs")
  startImportJob(
    @Body() body: ImportLegacyAcademicSelectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.legacyImport.startAcademicImportJob(body, user);
  }

  @Get("academics/import-jobs/:jobId")
  getImportJob(@Param("jobId") jobId: string) {
    return this.legacyImport.getAcademicImportJob(jobId);
  }

  @Post("batches/:batchId/rollback")
  rollbackBatch(@Param("batchId") batchId: string, @CurrentUser() user: AuthUser) {
    return this.legacyImport.rollbackBatch(batchId, user);
  }
}
