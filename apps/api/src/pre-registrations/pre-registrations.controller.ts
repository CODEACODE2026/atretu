import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import { DownloadStudentDocumentDto } from "../documents/dto/documents.dto.js";
import { publicPreRegistrationUploadOptions } from "../documents/multipart-upload.js";
import {
  OperationalRateLimit,
  OperationalRateLimitGuard,
  RATE_LIMITS,
} from "../security/operational-rate-limit.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  ApprovePreRegistrationDto,
  ListPreRegistrationsDto,
  RejectPreRegistrationDto,
} from "./dto/pre-registration-admin.dto.js";
import { CreatePublicPreRegistrationDto } from "./dto/pre-registration-public.dto.js";
import { PreRegistrationsService } from "./pre-registrations.service.js";

const publicUploadInterceptor = FileFieldsInterceptor(
  [
    { name: "cpfDocument", maxCount: 1 },
    { name: "rgDocument", maxCount: 1 },
    { name: "proofOfAddressDocument", maxCount: 1 },
    { name: "proofOfEnrollmentDocument", maxCount: 1 },
  ],
  publicPreRegistrationUploadOptions,
);

@Controller()
export class PreRegistrationsController {
  constructor(
    @Inject(PreRegistrationsService)
    private readonly preRegistrations: PreRegistrationsService,
  ) {}

  @Get("public/pre-registration/options")
  getPublicOptions() {
    return this.preRegistrations.getPublicOptions();
  }

  @Post("public/pre-registrations")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.publicUpload)
  @UseInterceptors(publicUploadInterceptor)
  createPublicPreRegistration(
    @Body() body: CreatePublicPreRegistrationDto,
    @UploadedFiles()
    files: Record<string, Express.Multer.File[] | undefined> | undefined,
    @Req() request: Request,
  ) {
    return this.preRegistrations.createPublicPreRegistration({
      body,
      files: {
        cpfDocument: files?.cpfDocument?.[0],
        rgDocument: files?.rgDocument?.[0],
        proofOfAddressDocument: files?.proofOfAddressDocument?.[0],
        proofOfEnrollmentDocument: files?.proofOfEnrollmentDocument?.[0],
      },
      ip: request.ip,
      userAgent: request.get("user-agent"),
    });
  }

  @UseGuards(AuthGuard, OperationalPermissionGuard)
  @OperationalPermission("preRegistrations.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  @Get("pre-registrations")
  listPreRegistrations(
    @Query() query: ListPreRegistrationsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.preRegistrations.listPreRegistrations(query, user);
  }

  @UseGuards(AuthGuard, OperationalPermissionGuard)
  @OperationalPermission("preRegistrations.view")
  @Get("pre-registrations/:id")
  getPreRegistration(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.preRegistrations.getPreRegistration(id, user);
  }

  @UseGuards(AuthGuard, OperationalPermissionGuard)
  @OperationalPermission("preRegistrations.documents.view")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.download)
  @Get("pre-registrations/:id/documents/:documentId/file")
  async getPreRegistrationDocumentFile(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Query() query: DownloadStudentDocumentDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.preRegistrations.getPreRegistrationDocumentFile({
      preRegistrationId: id,
      documentId,
      userId: user.id,
      currentUser: user,
      disposition: query.disposition,
    });
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", String(file.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      contentDisposition(file.disposition, file.fileName),
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'");
    return response.send(file.buffer);
  }

  @UseGuards(AuthGuard, OperationalPermissionGuard)
  @OperationalPermission("preRegistrations.review")
  @Post("pre-registrations/:id/approve")
  approvePreRegistration(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ApprovePreRegistrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.preRegistrations.approvePreRegistration(id, body, user.id, user);
  }

  @UseGuards(AuthGuard, OperationalPermissionGuard)
  @OperationalPermission("preRegistrations.review")
  @Post("pre-registrations/:id/reject")
  rejectPreRegistration(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RejectPreRegistrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.preRegistrations.rejectPreRegistration(
      id,
      body.reason,
      user.id,
      user,
    );
  }
}

function contentDisposition(disposition: string, fileName: string) {
  const fallbackFileName =
    fileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\;]/g, "_")
      .trim() || "documento";
  return `${disposition}; filename="${fallbackFileName}"; filename*=UTF-8''${encodeRFC5987ValueChars(fileName)}`;
}

function encodeRFC5987ValueChars(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
