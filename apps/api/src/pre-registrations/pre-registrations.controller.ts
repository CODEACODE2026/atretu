import { Body, Controller, Get, Inject, Post, Req, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { memoryStorage } from "multer";
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
}
