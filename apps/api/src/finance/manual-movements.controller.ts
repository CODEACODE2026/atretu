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
import { OperationalPermission } from "../auth/operational-permissions.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
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

@UseGuards(AuthGuard)
@Controller("finance/manual-movements")
export class ManualFinancialMovementsController {
  constructor(
    @Inject(ManualFinancialMovementsService)
    private readonly movements: ManualFinancialMovementsService,
  ) {}

  @Get()
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.view")
  list(
    @Query() query: ListManualFinancialMovementsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.list(query, user);
  }

  @Get(":movementId")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.view")
  get(
    @Param() params: ManualFinancialMovementParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.get(params.movementId, user);
  }

  @Post()
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.manage")
  @UseInterceptors(uploadInterceptor)
  create(
    @Body() body: CreateManualFinancialMovementDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.create(body, file, user);
  }

  @Patch(":movementId")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.manage")
  update(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: UpdateManualFinancialMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.update(params.movementId, body, user);
  }

  @Post(":movementId/mark-paid")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.manage")
  markPaid(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: MarkManualFinancialMovementPaidDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.markPaid(params.movementId, body, user);
  }

  @Post(":movementId/cancel")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.manage")
  cancel(
    @Param() params: ManualFinancialMovementParamsDto,
    @Body() body: CancelManualFinancialMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.cancel(params.movementId, body, user);
  }

  @Post(":movementId/attachments")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.manage")
  @UseInterceptors(attachmentUploadInterceptor)
  attach(
    @Param() params: ManualFinancialMovementParamsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.movements.attach(params.movementId, file, user);
  }

  @Get(":movementId/attachments/:attachmentId/view")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.manage")
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
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("manualMovements.manage")
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
