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
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import {
  manualFinancialMovementUploadOptions,
  singleDocumentUploadOptions,
} from "../documents/multipart-upload.js";
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

const uploadInterceptor = FileInterceptor(
  "file",
  manualFinancialMovementUploadOptions,
);
const attachmentUploadInterceptor = FileInterceptor(
  "file",
  singleDocumentUploadOptions,
);

@UseGuards(AuthGuard, RolesGuard)
@Controller("finance/manual-movements")
export class ManualFinancialMovementsController {
  constructor(
    @Inject(ManualFinancialMovementsService)
    private readonly movements: ManualFinancialMovementsService,
  ) {}

  @Get()
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  list(@Query() query: ListManualFinancialMovementsDto) {
    return this.movements.list(query);
  }

  @Get(":movementId")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  get(@Param() params: ManualFinancialMovementParamsDto) {
    return this.movements.get(params.movementId);
  }

  @Post()
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  @UseInterceptors(uploadInterceptor)
  create(
    @Body() body: CreateManualFinancialMovementDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.create(body, file, user);
  }

  @Patch(":movementId")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  update(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: UpdateManualFinancialMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.update(params.movementId, body, user);
  }

  @Post(":movementId/mark-paid")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  markPaid(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: MarkManualFinancialMovementPaidDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.markPaid(params.movementId, body, user);
  }

  @Post(":movementId/cancel")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  cancel(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: CancelManualFinancialMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.cancel(params.movementId, body, user);
  }

  @Post(":movementId/attachments")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  @UseInterceptors(attachmentUploadInterceptor)
  attach(
    @Param() params: ManualFinancialMovementParamsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.attach(params.movementId, file, user);
  }

  @Get(":movementId/attachments/:attachmentId/view")
  @Roles(...OPERATIONAL_ADMIN_ROLES)
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
  @Roles(...OPERATIONAL_ADMIN_ROLES)
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
