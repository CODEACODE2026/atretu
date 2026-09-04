import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { RoleCode } from "@prisma/client";
import type { Request } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import {
  OperationalRateLimit,
  OperationalRateLimitGuard,
  RATE_LIMITS,
} from "../security/operational-rate-limit.guard.js";
import {
  CreateAdminUserDto,
  ListAdminUsersDto,
  UpdateAdminUserDto,
  UpdateAdminUserInstitutionsDto,
} from "./dto/admin-users.dto.js";
import { UsersService, type AuthUser } from "./users.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.ADMINISTRATOR)
@Controller("admin/users")
export class AdminUsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  listUsers(@Query() query: ListAdminUsersDto, @CurrentUser() user: AuthUser) {
    return this.users.listAdminUsers(query, user);
  }

  @Get("permission-profiles")
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  listPermissionProfiles() {
    return this.users.listActivePermissionProfiles();
  }

  @Get(":id")
  getUser(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.users.getAdminUser(id, user);
  }

  @Post()
  createUser(
    @Body() body: CreateAdminUserDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.users.createAdminUser(body, user, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Patch(":id")
  updateUser(
    @Param("id") id: string,
    @Body() body: UpdateAdminUserDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.users.updateAdminUser(id, body, user, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Patch(":id/institutions")
  updateInstitutions(
    @Param("id") id: string,
    @Body() body: UpdateAdminUserInstitutionsDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.users.updateAdminUserInstitutions(
      id,
      body.institutionIds,
      user,
      {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      },
    );
  }

  @Patch(":id/block")
  blockUser(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.users.blockAdminUser(id, user, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Patch(":id/unblock")
  unblockUser(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.users.unblockAdminUser(id, user, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Post(":id/reset-password")
  resetPassword(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
  ) {
    return this.users.resetAdminUserTemporaryPassword(id, user, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }
}
