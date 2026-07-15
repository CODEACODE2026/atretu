import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RoleCode } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { DocumentsService } from "./documents.service.js";
import {
  DownloadStudentDocumentDto,
  ListStudentDocumentsDto,
  UploadStudentDocumentDto,
} from "./dto/documents.dto.js";
import { singleDocumentUploadOptions } from "./multipart-upload.js";

const uploadInterceptor = FileInterceptor("file", singleDocumentUploadOptions);

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
@Controller("students/:studentId/documents")
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}

  @Get()
  listDocuments(
    @Param("studentId") studentId: string,
    @Query() query: ListStudentDocumentsDto,
  ) {
    return this.documents.listStudentDocuments(studentId, query.status);
  }

  @Post()
  @UseInterceptors(uploadInterceptor)
  uploadDocument(
    @Param("studentId") studentId: string,
    @Body() body: UploadStudentDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.uploadStudentDocument(
      studentId,
      body.documentType,
      file,
      user.id,
    );
  }

  @Get(":documentId")
  getDocument(
    @Param("studentId") studentId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documents.getStudentDocument(studentId, documentId);
  }

  @Post(":documentId/replace")
  @UseInterceptors(uploadInterceptor)
  replaceDocument(
    @Param("studentId") studentId: string,
    @Param("documentId") documentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.replaceStudentDocument(
      studentId,
      documentId,
      file,
      user.id,
    );
  }

  @Get(":documentId/file")
  async getDocumentFile(
    @Param("studentId") studentId: string,
    @Param("documentId") documentId: string,
    @Query() query: DownloadStudentDocumentDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.documents.getDocumentFile(
      studentId,
      documentId,
      user.id,
      query.disposition,
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
    return file.buffer;
  }

  @Patch(":documentId/remove")
  removeDocument(
    @Param("studentId") studentId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.removeStudentDocument(studentId, documentId, user.id);
  }
}
