import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RoleCode } from "@prisma/client";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { singleDocumentUploadOptions } from "../documents/multipart-upload.js";
import type { AuthUser } from "../users/users.service.js";
import { AssociationSettingsService } from "./association-settings.service.js";
import { UpdateAssociationSettingsDto } from "./dto/association-settings.dto.js";

const uploadInterceptor = FileInterceptor("file", singleDocumentUploadOptions);

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN)
@Controller("admin/association-settings")
export class AssociationSettingsController {
  constructor(
    @Inject(AssociationSettingsService)
    private readonly settings: AssociationSettingsService,
  ) {}

  @Get()
  getSettings() {
    return this.settings.getSettings();
  }

  @Put()
  updateSettings(
    @Body() body: UpdateAssociationSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settings.updateSettings(body, user);
  }

  @Post("logo")
  @UseInterceptors(uploadInterceptor)
  updateLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.settings.updateLogo(file, user);
  }

  @Get("logo")
  async getLogo(
    @Query("key") key: string | undefined,
    @Res() response: Response,
  ) {
    const file = await this.settings.getLogoFile(key);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.send(file.buffer);
  }
}
