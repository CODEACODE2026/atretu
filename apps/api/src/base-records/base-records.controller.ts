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
import { RoleCode } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
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

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
@Controller()
export class BaseRecordsController {
  constructor(
    @Inject(BaseRecordsService)
    private readonly baseRecords: BaseRecordsService,
  ) {}

  @Get("institutions")
  listInstitutions(@Query() query: ListBaseRecordsDto) {
    return this.baseRecords.listInstitutions(query);
  }

  @Post("institutions")
  createInstitution(
    @Body() body: CreateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.createInstitution(body, user.id);
  }

  @Get("institutions/:id")
  getInstitution(@Param("id") id: string) {
    return this.baseRecords.getInstitution(id);
  }

  @Patch("institutions/:id")
  updateInstitution(
    @Param("id") id: string,
    @Body() body: UpdateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.updateInstitution(id, body, user.id);
  }

  @Patch("institutions/:id/inactivate")
  inactivateInstitution(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.inactivateInstitution(id, user.id);
  }

  @Patch("institutions/:id/reactivate")
  reactivateInstitution(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.reactivateInstitution(id, user.id);
  }

  @Get("shifts")
  listShifts(@Query() query: ListBaseRecordsDto) {
    return this.baseRecords.listShifts(query);
  }

  @Post("shifts")
  createShift(
    @Body() body: CreateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.createShift(body, user.id);
  }

  @Get("shifts/:id")
  getShift(@Param("id") id: string) {
    return this.baseRecords.getShift(id);
  }

  @Patch("shifts/:id")
  updateShift(
    @Param("id") id: string,
    @Body() body: UpdateNamedRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.updateShift(id, body, user.id);
  }

  @Patch("shifts/:id/inactivate")
  inactivateShift(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.inactivateShift(id, user.id);
  }

  @Patch("shifts/:id/reactivate")
  reactivateShift(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.reactivateShift(id, user.id);
  }

  @Get("buses")
  listBuses(@Query() query: ListBaseRecordsDto) {
    return this.baseRecords.listBuses(query);
  }

  @Post("buses")
  createBus(@Body() body: CreateBusDto, @CurrentUser() user: AuthUser) {
    return this.baseRecords.createBus(body, user.id);
  }

  @Get("buses/:id")
  getBus(@Param("id") id: string) {
    return this.baseRecords.getBus(id);
  }

  @Patch("buses/:id")
  updateBus(
    @Param("id") id: string,
    @Body() body: UpdateBusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.baseRecords.updateBus(id, body, user.id);
  }

  @Patch("buses/:id/inactivate")
  inactivateBus(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.inactivateBus(id, user.id);
  }

  @Patch("buses/:id/reactivate")
  reactivateBus(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.baseRecords.reactivateBus(id, user.id);
  }
}
