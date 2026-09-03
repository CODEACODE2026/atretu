import {
  Controller,
  Body,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { OfficialDocumentModelStatus, OfficialDocumentType, RoleCode } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import {
  GLOBAL_OPERATIONAL_ADMIN_ROLES,
  Roles,
} from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  DownloadOfficialDocumentDto,
  CreateOfficialDocumentModelDto,
  InvalidateOfficialDocumentDto,
  IssueDynamicOfficialDocumentDto,
  IssueInstitutionalOfficialDocumentDto,
  IssueOfficialDocumentDto,
  ListOfficialDocumentIssuesDto,
  UpdateOfficialDocumentModelDto,
  UpdateOfficialDocumentModelStatusDto,
} from "./dto/official-documents.dto.js";
import { OfficialDocumentsService } from "./official-documents.service.js";

function isGlobalOperationalAdmin(user: AuthUser) {
  return GLOBAL_OPERATIONAL_ADMIN_ROLES.some((role) => user.roles.includes(role));
}

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller("students/:studentId/official-documents")
export class OfficialDocumentsController {
  constructor(
    @Inject(OfficialDocumentsService)
    private readonly officialDocuments: OfficialDocumentsService,
  ) {}

  @Get()
  @OperationalPermission("officialDocuments.view")
  listOfficialDocuments(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.listStudentOfficialDocuments(studentId, user);
  }

  @Get("model-issues")
  @OperationalPermission("officialDocuments.view")
  listStudentModelIssues(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.listStudentModelIssues(studentId, user);
  }

  @Post("models/:modelId/preview")
  @OperationalPermission("officialDocuments.issue")
  previewDynamicDocument(
    @Param("studentId") studentId: string,
    @Param("modelId") modelId: string,
    @Body() body: IssueDynamicOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.previewDynamicDocument(
      studentId,
      modelId,
      user,
      body,
    );
  }

  @Post("models/:modelId/issue")
  @OperationalPermission("officialDocuments.issue")
  issueDynamicDocument(
    @Param("studentId") studentId: string,
    @Param("modelId") modelId: string,
    @Body() body: IssueDynamicOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.issueDynamicDocument(
      studentId,
      modelId,
      user,
      body,
    );
  }

  @Post(":type/issue")
  @OperationalPermission("officialDocuments.issue")
  issueOfficialDocument(
    @Param("studentId") studentId: string,
    @Param("type", new ParseEnumPipe(OfficialDocumentType))
    type: OfficialDocumentType,
    @Body() body: IssueOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.issueDocument(studentId, type, user, undefined, body);
  }

  @Post(":issueId/reissue")
  @OperationalPermission("officialDocuments.issue")
  reissueOfficialDocument(
    @Param("studentId") studentId: string,
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.reissueDocument(studentId, issueId, user);
  }

  @Roles(RoleCode.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @Post(":issueId/invalidate")
  invalidateOfficialDocument(
    @Param("studentId") studentId: string,
    @Param("issueId") issueId: string,
    @Body() body: InvalidateOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.invalidateStudentIssue(
      studentId,
      issueId,
      body,
      user,
    );
  }

  @Get(":issueId")
  @OperationalPermission("officialDocuments.view")
  getOfficialDocumentIssue(
    @Param("studentId") studentId: string,
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.getIssue(studentId, issueId, user);
  }

  @Get(":issueId/file")
  @OperationalPermission("officialDocuments.view")
  async getOfficialDocumentFile(
    @Param("studentId") studentId: string,
    @Param("issueId") issueId: string,
    @Query() query: DownloadOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.officialDocuments.getIssueFile(
      studentId,
      issueId,
      query.disposition,
      user,
    );
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", String(file.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      `${file.disposition}; filename=\"${file.fileName}\"`,
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'");
    return response.send(file.buffer);
  }
}

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller("official-documents/issues")
export class OfficialDocumentIssuesController {
  constructor(
    @Inject(OfficialDocumentsService)
    private readonly officialDocuments: OfficialDocumentsService,
  ) {}

  @Get()
  @OperationalPermission("officialDocuments.view")
  listIssues(
    @Query() query: ListOfficialDocumentIssuesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.listIssues(query, user);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(...GLOBAL_OPERATIONAL_ADMIN_ROLES)
@Controller("official-documents/models")
export class OfficialDocumentModelsController {
  constructor(
    @Inject(OfficialDocumentsService)
    private readonly officialDocuments: OfficialDocumentsService,
  ) {}

  @Get("variables")
  listVariables() {
    return this.officialDocuments.listTemplateVariables();
  }

  @Get()
  @Roles()
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("officialDocuments.issue")
  listModels(
    @Query("status") status: OfficialDocumentModelStatus | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!isGlobalOperationalAdmin(user) && status !== OfficialDocumentModelStatus.ACTIVE) {
      throw new ForbiddenException("Acesso negado");
    }
    return this.officialDocuments.listModels(status);
  }

  @Get("issues")
  listModelIssues() {
    return this.officialDocuments.listModelIssues();
  }

  @Get(":modelId")
  getModel(@Param("modelId") modelId: string) {
    return this.officialDocuments.getModel(modelId);
  }

  @Post()
  createModel(
    @Body() body: CreateOfficialDocumentModelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.createModel(body, user);
  }

  @Post(":modelId/duplicate")
  duplicateModel(
    @Param("modelId") modelId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.duplicateModel(modelId, user);
  }

  @Post(":modelId/status")
  updateModelStatus(
    @Param("modelId") modelId: string,
    @Body() body: UpdateOfficialDocumentModelStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.updateModelStatus(modelId, body.status, user);
  }

  @Post(":modelId")
  updateModel(
    @Param("modelId") modelId: string,
    @Body() body: UpdateOfficialDocumentModelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.updateModel(modelId, body, user);
  }
}

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller("official-documents/institutional")
export class InstitutionalOfficialDocumentsController {
  constructor(
    @Inject(OfficialDocumentsService)
    private readonly officialDocuments: OfficialDocumentsService,
  ) {}

  @Get()
  @OperationalPermission("officialDocuments.view")
  listInstitutionalOfficialDocuments() {
    return this.officialDocuments.listInstitutionalOfficialDocuments();
  }

  @Post(":type/issue")
  @OperationalPermission("officialDocuments.issue")
  issueInstitutionalOfficialDocument(
    @Param("type", new ParseEnumPipe(OfficialDocumentType))
    type: OfficialDocumentType,
    @Body() body: IssueInstitutionalOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.issueInstitutionalDocument(type, user, undefined, body);
  }

  @Post(":issueId/reissue")
  @OperationalPermission("officialDocuments.issue")
  reissueInstitutionalOfficialDocument(
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.reissueInstitutionalDocument(issueId, user);
  }

  @Get(":issueId")
  @OperationalPermission("officialDocuments.view")
  getInstitutionalOfficialDocumentIssue(@Param("issueId") issueId: string) {
    return this.officialDocuments.getInstitutionalIssue(issueId);
  }

  @Get(":issueId/file")
  @OperationalPermission("officialDocuments.view")
  async getInstitutionalOfficialDocumentFile(
    @Param("issueId") issueId: string,
    @Query() query: DownloadOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.officialDocuments.getInstitutionalIssueFile(
      issueId,
      query.disposition,
      user,
    );
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", String(file.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      `${file.disposition}; filename=\"${file.fileName}\"`,
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'");
    return response.send(file.buffer);
  }
}
