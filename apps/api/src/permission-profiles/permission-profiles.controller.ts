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
import {
  OperationalRateLimit,
  OperationalRateLimitGuard,
  RATE_LIMITS,
} from "../security/operational-rate-limit.guard.js";
import type { AuthUser } from "../users/users.service.js";
import {
  CreatePermissionProfileDto,
  ListPermissionProfilesDto,
  UpdatePermissionProfileDto,
} from "./dto/permission-profiles.dto.js";
import { PermissionProfilesService } from "./permission-profiles.service.js";

@UseGuards(AuthGuard, RolesGuard)
@Roles(RoleCode.SUPER_ADMIN, RoleCode.ADMINISTRATOR)
@Controller("admin/permission-profiles")
export class PermissionProfilesController {
  constructor(
    @Inject(PermissionProfilesService)
    private readonly permissionProfiles: PermissionProfilesService,
  ) {}

  @Get("catalog")
  catalog() {
    return this.permissionProfiles.catalog();
  }

  @Get()
  @UseGuards(OperationalRateLimitGuard)
  @OperationalRateLimit(RATE_LIMITS.search)
  list(@Query() query: ListPermissionProfilesDto) {
    return this.permissionProfiles.list(query);
  }

  @Post()
  create(
    @Body() body: CreatePermissionProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissionProfiles.create(body, user);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.permissionProfiles.get(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdatePermissionProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissionProfiles.update(id, body, user);
  }

  @Patch(":id/inactivate")
  inactivate(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.permissionProfiles.setActive(id, false, user);
  }

  @Patch(":id/reactivate")
  reactivate(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.permissionProfiles.setActive(id, true, user);
  }
}
