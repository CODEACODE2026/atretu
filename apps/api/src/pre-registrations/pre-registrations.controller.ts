import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { RoleCode } from "@prisma/client";
import type { Request, Response } from "express";
import { memoryStorage } from "multer";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { DownloadStudentDocumentDto } from "../documents/dto/documents.dto.js";
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
  { storage: memoryStorage() },
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

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @Get("pre-registrations")
  listPreRegistrations(@Query() query: ListPreRegistrationsDto) {
    return this.preRegistrations.listPreRegistrations(query);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @Get("pre-registrations/:id")
  getPreRegistration(@Param("id") id: string) {
    return this.preRegistrations.getPreRegistration(id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @Get("pre-registrations/:id/documents/:documentId/file")
  async getPreRegistrationDocumentFile(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Query() query: DownloadStudentDocumentDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.preRegistrations.getPreRegistrationDocumentFile({
      preRegistrationId: id,
      documentId,
      userId: user.id,
      disposition: query.disposition,
    });
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

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @Post("pre-registrations/:id/approve")
  approvePreRegistration(
    @Param("id") id: string,
    @Body() body: ApprovePreRegistrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.preRegistrations.approvePreRegistration(id, body, user.id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @Post("pre-registrations/:id/reject")
  rejectPreRegistration(
    @Param("id") id: string,
    @Body() body: RejectPreRegistrationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.preRegistrations.rejectPreRegistration(id, body.reason, user.id);
  }
}
