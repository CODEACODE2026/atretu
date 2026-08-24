import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  CancelInvoiceDto,
  CreateInvoiceDto,
  InvoicePreviewDto,
  ListInvoicesDto,
} from "./dto/invoices.dto.js";
import { InvoicesService } from "./invoices.service.js";

@UseGuards(AuthGuard, OperationalPermissionGuard)
@Controller()
export class InvoicesController {
  constructor(
    @Inject(InvoicesService) private readonly invoices: InvoicesService,
  ) {}

  @Get("finance/invoices")
  @OperationalPermission("finance.invoices.view")
  listInvoices(@Query() query: ListInvoicesDto, @CurrentUser() user: AuthUser) {
    return this.invoices.listInvoices(query, user);
  }

  @Get("finance/invoices/:id")
  @OperationalPermission("finance.invoices.view")
  getInvoice(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.invoices.getInvoice(id, user);
  }

  @Get("students/:studentId/invoices")
  @OperationalPermission("finance.invoices.view")
  listStudentInvoices(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.listStudentInvoices(studentId, user);
  }

  @Get("students/:studentId/invoice-preview")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  previewInvoice(
    @Param("studentId") studentId: string,
    @Query() query: InvoicePreviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.previewInvoice(studentId, query, user);
  }

  @Post("students/:studentId/invoices")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  createInvoice(
    @Param("studentId") studentId: string,
    @Body() body: CreateInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.createInvoice(studentId, body, user.id, user);
  }

  @Post("finance/invoices/:id/cancel")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  cancelInvoice(
    @Param("id") id: string,
    @Body() body: CancelInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.cancelInvoice(id, body, user.id, user);
  }
}
