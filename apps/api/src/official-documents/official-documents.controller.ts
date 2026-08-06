import {
  Controller,
  Body,
  Get,
  Inject,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { OfficialDocumentType, RoleCode } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  DownloadOfficialDocumentDto,
  IssueInstitutionalOfficialDocumentDto,
  IssueOfficialDocumentDto,
} from "./dto/official-documents.dto.js";
import { OfficialDocumentsService } from "./official-documents.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
@Controller("students/:studentId/official-documents")
export class OfficialDocumentsController {
  constructor(
    @Inject(OfficialDocumentsService)
    private readonly officialDocuments: OfficialDocumentsService,
  ) {}

  @Get()
  listOfficialDocuments(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.listStudentOfficialDocuments(studentId, user);
  }

  @Post(":type/issue")
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
  reissueOfficialDocument(
    @Param("studentId") studentId: string,
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.reissueDocument(studentId, issueId, user);
  }

  @Get(":issueId")
  getOfficialDocumentIssue(
    @Param("studentId") studentId: string,
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.getIssue(studentId, issueId, user);
  }

  @Get(":issueId/file")
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

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
@Controller("official-documents/institutional")
export class InstitutionalOfficialDocumentsController {
  constructor(
    @Inject(OfficialDocumentsService)
    private readonly officialDocuments: OfficialDocumentsService,
  ) {}

  @Get()
  listInstitutionalOfficialDocuments() {
    return this.officialDocuments.listInstitutionalOfficialDocuments();
  }

  @Roles(RoleCode.SUPER_ADMIN)
  @Post(":type/issue")
  issueInstitutionalOfficialDocument(
    @Param("type", new ParseEnumPipe(OfficialDocumentType))
    type: OfficialDocumentType,
    @Body() body: IssueInstitutionalOfficialDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.issueInstitutionalDocument(type, user, undefined, body);
  }

  @Roles(RoleCode.SUPER_ADMIN)
  @Post(":issueId/reissue")
  reissueInstitutionalOfficialDocument(
    @Param("issueId") issueId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.officialDocuments.reissueInstitutionalDocument(issueId, user);
  }

  @Get(":issueId")
  getInstitutionalOfficialDocumentIssue(@Param("issueId") issueId: string) {
    return this.officialDocuments.getInstitutionalIssue(issueId);
  }

  @Get(":issueId/file")
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
