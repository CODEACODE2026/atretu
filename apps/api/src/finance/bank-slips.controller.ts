import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { BankSlipIssueBatchSource, RoleCode } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { BankSlipsService } from "./bank-slips.service.js";
import {
  BankSlipIssueBatchParamsDto,
  BankSlipSyncRunParamsDto,
  CancelBankSlipIssueBatchDto,
  CreateBankSlipIssueBatchDto,
  InvoiceBankSlipParamsDto,
  ListBankSlipIssueBatchItemsDto,
  ListBankSlipIssueBatchesDto,
  ListBankSlipSyncRunItemsDto,
  ListBankSlipSyncRunsDto,
  PreviewBankSlipIssueBatchDto,
  RecoverBankSlipPdfsDto,
  RecoverIssuedBankSlipDto,
  RetryBankSlipIssueBatchDto,
  RequestBankSlipCancellationDto,
  SyncPaidBankSlipsDayDto,
} from "./dto/bank-slips.dto.js";

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller()
export class BankSlipsController {
  constructor(
    @Inject(BankSlipsService) private readonly bankSlips: BankSlipsService,
  ) {}

  @Post("finance/invoices/:invoiceId/bank-slip/issue")
  @OperationalPermission("finance.bankSlips.manage")
  issueForInvoice(
    @Param() params: InvoiceBankSlipParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.issueForInvoice(params.invoiceId, user.id, user);
  }

  @Get("finance/invoices/:invoiceId/bank-slip")
  @OperationalPermission("finance.invoices.view")
  getByInvoice(
    @Param() params: InvoiceBankSlipParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.getByInvoice(params.invoiceId, user);
  }

  @Post("finance/invoices/:invoiceId/bank-slip/sync")
  @OperationalPermission("finance.bankSlips.manage")
  syncByInvoice(@Param() params: InvoiceBankSlipParamsDto, @CurrentUser() user: AuthUser) {
    return this.bankSlips.syncByInvoice(params.invoiceId, user.id, user);
  }

  @Post("finance/invoices/:invoiceId/bank-slip/recover-issued")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  recoverIssuedFromProviderResponse(
    @Param() params: InvoiceBankSlipParamsDto,
    @Body() body: RecoverIssuedBankSlipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.recoverIssuedFromProviderResponse(
      params.invoiceId,
      user.id,
      body,
      user,
    );
  }

  @Post("finance/bank-slips/sync-paid-day")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  syncPaidByDay(
    @Body() body: SyncPaidBankSlipsDayDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.syncPaidByDay(body.date, user.id);
  }

  @Post("finance/bank-slips/sync-open-issued")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  syncOpenIssued(@CurrentUser() user: AuthUser) {
    return this.bankSlips.syncOpenIssued(user.id);
  }

  @Post("finance/bank-slips/recover-pdfs")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  recoverBankSlipPdfs(@Body() body: RecoverBankSlipPdfsDto) {
    return this.bankSlips.recoverMissingPdfs(body.limit);
  }

  @Get("finance/bank-slip-sync-runs")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  listSyncRuns(@Query() query: ListBankSlipSyncRunsDto) {
    return this.bankSlips.listSyncRuns(query);
  }

  @Get("finance/bank-slip-sync-runs/:runId")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  getSyncRun(@Param() params: BankSlipSyncRunParamsDto) {
    return this.bankSlips.getSyncRun(params.runId);
  }

  @Get("finance/bank-slip-sync-runs/:runId/items")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  listSyncRunItems(
    @Param() params: BankSlipSyncRunParamsDto,
    @Query() query: ListBankSlipSyncRunItemsDto,
  ) {
    return this.bankSlips.listSyncRunItems(params.runId, query);
  }

  @Post("finance/bank-slip-issue-batches")
  @OperationalPermission("finance.bankSlips.manage")
  createIssueBatch(
    @Body() body: CreateBankSlipIssueBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertIssueBatchCreateAllowed(body, user);
    return this.bankSlips.createIssueBatch(
      body,
      user.id,
      {
        processImmediately: true,
      },
      user,
    );
  }

  @Post("finance/bank-slip-issue-batches/preview")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  previewIssueBatch(
    @Body() body: PreviewBankSlipIssueBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.previewIssueBatch(body, user);
  }

  @Get("finance/bank-slip-issue-batches")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  listIssueBatches(
    @Query() query: ListBankSlipIssueBatchesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.listIssueBatches(query, user);
  }

  @Get("finance/bank-slip-issue-batches/:batchId")
  @OperationalPermission("finance.bankSlips.manage")
  getIssueBatch(
    @Param() params: BankSlipIssueBatchParamsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.getIssueBatch(params.batchId, user);
  }

  @Get("finance/bank-slip-issue-batches/:batchId/items")
  @OperationalPermission("finance.bankSlips.manage")
  listIssueBatchItems(
    @Param() params: BankSlipIssueBatchParamsDto,
    @Query() query: ListBankSlipIssueBatchItemsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.listIssueBatchItems(params.batchId, query, user);
  }

  @Get("finance/bank-slip-issue-batches/:batchId/download")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  @Header("Cache-Control", "no-store, private")
  @Header("X-Content-Type-Options", "nosniff")
  async downloadIssueBatchPdfs(
    @Param() params: BankSlipIssueBatchParamsDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const archive = await this.bankSlips.downloadIssueBatchPdfs(
      params.batchId,
      user,
    );
    response.setHeader("Content-Type", "application/zip");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${archive.fileName}"`,
    );
    response.setHeader("X-Bank-Slip-Zip-Total", String(archive.totals.total));
    response.setHeader("X-Bank-Slip-Zip-Included", String(archive.totals.included));
    response.setHeader("X-Bank-Slip-Zip-Skipped", String(archive.totals.skipped));
    response.setHeader("X-Bank-Slip-Zip-Failed", String(archive.totals.failed));
    if (archive.totals.firstFailure) {
      response.setHeader(
        "X-Bank-Slip-Zip-First-Failure",
        encodeURIComponent(archive.totals.firstFailure),
      );
    }
    archive.stream.pipe(response);
  }

  @Post("finance/bank-slip-issue-batches/:batchId/cancel")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  cancelIssueBatch(
    @Param() params: BankSlipIssueBatchParamsDto,
    @Body() body: CancelBankSlipIssueBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.cancelIssueBatch(params.batchId, user.id, body, user);
  }

  @Post("finance/bank-slip-issue-batches/:batchId/retry-failed")
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  retryFailedIssueBatch(
    @Param() params: BankSlipIssueBatchParamsDto,
    @Body() body: RetryBankSlipIssueBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.retryFailedIssueBatch(params.batchId, user.id, body);
  }

  @Post("finance/invoices/:invoiceId/bank-slip/cancel")
  @OperationalPermission("finance.bankSlips.manage")
  requestCancellation(
    @Param() params: InvoiceBankSlipParamsDto,
    @Body() body: RequestBankSlipCancellationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bankSlips.requestCancellation(
      params.invoiceId,
      user.id,
      body,
      user,
    );
  }

  @Get("finance/invoices/:invoiceId/bank-slip/pdf")
  @OperationalPermission("finance.bankSlips.manage")
  @Header("Cache-Control", "no-store, private")
  @Header("X-Content-Type-Options", "nosniff")
  async getPdf(
    @Param() params: InvoiceBankSlipParamsDto,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const pdf = await this.bankSlips.getPdf(params.invoiceId, user);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Length", String(pdf.sizeBytes));
    response.setHeader("Content-Disposition", `attachment; filename="${pdf.filename}"`);
    response.send(pdf.bytes);
  }

  private assertIssueBatchCreateAllowed(
    body: CreateBankSlipIssueBatchDto,
    user: AuthUser,
  ) {
    const source =
      body.source ??
      (body.institutionId
        ? BankSlipIssueBatchSource.INSTITUTION
        : BankSlipIssueBatchSource.MANUAL);
    if (source === BankSlipIssueBatchSource.MANUAL) {
      return;
    }
    if (OPERATIONAL_ADMIN_ROLES.some((role) => user.roles.includes(role))) {
      return;
    }
    throw new ForbiddenException("Acesso negado");
  }
}
