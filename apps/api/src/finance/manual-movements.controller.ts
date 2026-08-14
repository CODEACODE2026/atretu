import {
  Body,
  Controller,
  Get,
  Header,
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
import { singleDocumentUploadOptions } from "../documents/multipart-upload.js";
import type { AuthUser } from "../users/users.service.js";
import {
  CancelManualFinancialMovementDto,
  CreateManualFinancialMovementDto,
  ListManualFinancialMovementsDto,
  ManualFinancialMovementAttachmentParamsDto,
  ManualFinancialMovementParamsDto,
  MarkManualFinancialMovementPaidDto,
  UpdateManualFinancialMovementDto,
} from "./dto/manual-movements.dto.js";
import { ManualFinancialMovementsService } from "./manual-movements.service.js";

const uploadInterceptor = FileInterceptor("file", singleDocumentUploadOptions);

@UseGuards(AuthGuard, RolesGuard)
@Controller("finance/manual-movements")
export class ManualFinancialMovementsController {
  constructor(
    @Inject(ManualFinancialMovementsService)
    private readonly movements: ManualFinancialMovementsService,
  ) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  list(@Query() query: ListManualFinancialMovementsDto) {
    return this.movements.list(query);
  }

  @Get(":movementId")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  get(@Param() params: ManualFinancialMovementParamsDto) {
    return this.movements.get(params.movementId);
  }

  @Post()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @UseInterceptors(uploadInterceptor)
  create(
    @Body() body: CreateManualFinancialMovementDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.create(body, file, user);
  }

  @Patch(":movementId")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  update(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: UpdateManualFinancialMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.update(params.movementId, body, user);
  }

  @Post(":movementId/mark-paid")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  markPaid(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: MarkManualFinancialMovementPaidDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.markPaid(params.movementId, body, user);
  }

  @Post(":movementId/cancel")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  cancel(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: CancelManualFinancialMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.cancel(params.movementId, body, user);
  }

  @Post(":movementId/attachments")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @UseInterceptors(uploadInterceptor)
  attach(
    @Param() params: ManualFinancialMovementParamsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.attach(params.movementId, file, user);
  }

  @Get(":movementId/attachments/:attachmentId/view")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @Header("Cache-Control", "no-store, private")
  @Header("X-Content-Type-Options", "nosniff")
  async viewAttachment(
    @Param() params: ManualFinancialMovementAttachmentParamsDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.movements.readAttachment(
      params.movementId,
      params.attachmentId,
      "inline",
      user,
    );
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", String(file.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    response.send(file.buffer);
  }

  @Get(":movementId/attachments/:attachmentId/download")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  @Header("Cache-Control", "no-store, private")
  @Header("X-Content-Type-Options", "nosniff")
  async downloadAttachment(
    @Param() params: ManualFinancialMovementAttachmentParamsDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const file = await this.movements.readAttachment(
      params.movementId,
      params.attachmentId,
      "download",
      user,
    );
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", String(file.sizeBytes));
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    response.send(file.buffer);
  }
}
