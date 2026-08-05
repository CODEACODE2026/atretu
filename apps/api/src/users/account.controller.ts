import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AllowDuringPasswordChange } from "../auth/allow-during-password-change.decorator.js";
import { AUTH_COOKIE_NAME } from "../auth/auth.constants.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { AppConfigService } from "../config/app-config.service.js";
import { ChangePasswordDto, UpdateOwnAccountDto } from "./dto/account.dto.js";
import { UsersService, type AuthUser } from "./users.service.js";

@UseGuards(AuthGuard)
@Controller("account")
export class AccountController {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  @Get()
  @AllowDuringPasswordChange()
  getAccount(@CurrentUser() user: AuthUser) {
    return { user: this.users.toAccountUser(user) };
  }

  @Patch()
  updateAccount(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateOwnAccountDto,
    @Req() request: Request,
  ) {
    return this.users.updateOwnAccount(user.id, body, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  }

  @Patch("password")
  @AllowDuringPasswordChange()
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.users.changeOwnPassword(user.id, body, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    response.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.values.nodeEnv === "production",
      path: "/",
    });
    return result;
  }
}
