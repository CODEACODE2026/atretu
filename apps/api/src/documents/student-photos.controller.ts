import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import {
  OperationalRateLimit,
  OperationalRateLimitGuard,
  RATE_LIMITS,
} from "../security/operational-rate-limit.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { DocumentsService } from "./documents.service.js";
import { DownloadStudentDocumentDto } from "./dto/documents.dto.js";
import { singleDocumentUploadOptions } from "./multipart-upload.js";

const uploadInterceptor = FileInterceptor("file", singleDocumentUploadOptions);

@UseGuards(AuthGuard, RolesGuard)
@Roles(...OPERATIONAL_ADMIN_ROLES)
@Controller("students/:studentId/photo")
export class StudentPhotosController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}

  @Get()
  getPhoto(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.getStudentPhoto(studentId, user);
  }

  @Post()
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.upload)
  @UseInterceptors(uploadInterceptor)
  uploadOrReplacePhoto(
    @Param("studentId") studentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.uploadOrReplaceStudentPhoto(
      studentId,
      file,
      user.id,
      user,
    );
  }

  @Delete()
  removePhoto(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.removeStudentPhoto(studentId, user.id, user);
  }

  @Get("file")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.download)
  async getPhotoFile(
    @Param("studentId") studentId: string,
    @Query() query: DownloadStudentDocumentDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.documents.getStudentPhotoFile(
      studentId,
      user.id,
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
