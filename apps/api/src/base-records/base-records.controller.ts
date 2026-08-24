import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { OperationalPermissionGuard } from "../auth/operational-permission.guard.js";
import { OperationalPermission } from "../auth/operational-permissions.js";
import { OPERATIONAL_ADMIN_ROLES, Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import type { AuthUser } from "../users/users.service.js";
import { BaseRecordsService } from "./base-records.service.js";
import {
  CreateBusDto,
  CreateNamedRecordDto,
  ListBaseRecordsDto,
  UpdateBusDto,
  UpdateNamedRecordDto,
} from "./dto/base-record.dto.js";

@UseGuards(AuthGuard)
@Controller()
export class BaseRecordsController {
  constructor(
    @Inject(BaseRecordsService)
    private readonly baseRecords: BaseRecordsService,
  ) {}

  @Get("institutions")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("students.view", "reports.view", "baseRecords.view")
  listInstitutions(
    @Query() query: ListBaseRecordsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.listInstitutions(query, user);
  }

  @Post("institutions")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  createInstitution(
    @Body() body: CreateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.createInstitution(body, user.id);
  }

  @Get("institutions/:id")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("baseRecords.view")
  getInstitution(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.getInstitution(id, user);
  }

  @Patch("institutions/:id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  updateInstitution(
    @Param("id") id: string,
    @Body() body: UpdateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.updateInstitution(id, body, user);
  }

  @Patch("institutions/:id/inactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  inactivateInstitution(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.inactivateInstitution(id, user);
  }

  @Patch("institutions/:id/reactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  reactivateInstitution(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.reactivateInstitution(id, user);
  }

  @Get("shifts")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("students.view", "reports.view", "baseRecords.view")
  listShifts(@Query() query: ListBaseRecordsDto) {
    return this.baseRecords.listShifts(query);
  }

  @Post("shifts")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  createShift(
    @Body() body: CreateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.createShift(body, user.id);
  }

  @Get("shifts/:id")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("baseRecords.view")
  getShift(@Param("id") id: string) {
    return this.baseRecords.getShift(id);
  }

  @Patch("shifts/:id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  updateShift(
    @Param("id") id: string,
    @Body() body: UpdateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.updateShift(id, body, user.id);
  }

  @Patch("shifts/:id/inactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  inactivateShift(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.inactivateShift(id, user.id);
  }

  @Patch("shifts/:id/reactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  reactivateShift(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.reactivateShift(id, user.id);
  }

  @Get("buses")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("students.view", "reports.view", "baseRecords.view")
  listBuses(@Query() query: ListBaseRecordsDto, @CurrentUser() user: AuthUser) {
    return this.baseRecords.listBuses(query, user);
  }

  @Post("buses")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  createBus(@Body() body: CreateBusDto, @CurrentUser() user: AuthUser) {
    return this.baseRecords.createBus(body, user.id);
  }

  @Get("buses/:id")
  @UseGuards(OperationalPermissionGuard)
  @OperationalPermission("baseRecords.view")
  getBus(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.getBus(id, user);
  }

  @Patch("buses/:id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  updateBus(
    @Param("id") id: string,
    @Body() body: UpdateBusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.updateBus(id, body, user.id);
  }

  @Patch("buses/:id/inactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  inactivateBus(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.inactivateBus(id, user.id);
  }

  @Patch("buses/:id/reactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_ADMIN_ROLES)
  reactivateBus(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.reactivateBus(id, user.id);
  }
}
