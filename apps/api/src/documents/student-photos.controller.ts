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
import { RoleCode } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { DocumentsService } from "./documents.service.js";
import { DownloadStudentDocumentDto } from "./dto/documents.dto.js";
import { singleDocumentUploadOptions } from "./multipart-upload.js";

const uploadInterceptor = FileInterceptor("file", singleDocumentUploadOptions);

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
@Controller("students/:studentId/photo")
export class StudentPhotosController {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}

  @Get()
  getPhoto(@Param("studentId") studentId: string) {
    return this.documents.getStudentPhoto(studentId);
  }

  @Post()
  @UseInterceptors(uploadInterceptor)
  uploadOrReplacePhoto(
    @Param("studentId") studentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.uploadOrReplaceStudentPhoto(studentId, file, user.id);
  }

  @Delete()
  removePhoto(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.removeStudentPhoto(studentId, user.id);
  }

  @Get("file")
  async getPhotoFile(
    @Param("studentId") studentId: string,
    @Query() query: DownloadStudentDocumentDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.documents.getStudentPhotoFile(
      studentId,
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
}
