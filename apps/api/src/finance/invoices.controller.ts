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
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  CancelInvoiceDto,
  CreateInvoiceDto,
  InvoicePreviewDto,
  ListInvoicesDto,
} from "./dto/invoices.dto.js";
import { InvoicesService } from "./invoices.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class InvoicesController {
  constructor(
    @Inject(InvoicesService) private readonly invoices: InvoicesService,
  ) {}

  @Get("finance/invoices")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.invoices.listInvoices(query);
  }

  @Get("finance/invoices/:id")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  getInvoice(@Param("id") id: string) {
    return this.invoices.getInvoice(id);
  }

  @Get("students/:studentId/invoices")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  listStudentInvoices(@Param("studentId") studentId: string) {
    return this.invoices.listStudentInvoices(studentId);
  }

  @Get("students/:studentId/invoice-preview")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  previewInvoice(
    @Param("studentId") studentId: string,
    @Query() query: InvoicePreviewDto,
  ) {
    return this.invoices.previewInvoice(studentId, query);
  }

  @Post("students/:studentId/invoices")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  createInvoice(
    @Param("studentId") studentId: string,
    @Body() body: CreateInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.createInvoice(studentId, body, user.id);
  }

  @Post("finance/invoices/:id/cancel")
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  cancelInvoice(
    @Param("id") id: string,
    @Body() body: CancelInvoiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.cancelInvoice(id, body, user.id);
  }
}
