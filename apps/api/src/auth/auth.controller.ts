import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuditEventType, RoleCode } from "@prisma/client";
import type { Request, Response } from "express";
import { AppConfigService } from "../config/app-config.service.js";
import { RateLimitService } from "../security/rate-limit.service.js";
import { SecurityAuditService } from "../security/security-audit.service.js";
import type { AuthUser } from "../users/users.service.js";
import { AUTH_COOKIE_NAME } from "./auth.constants.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { BootstrapAdminDto } from "./dto/bootstrap-admin.dto.js";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { Roles } from "./roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";
import { timingSafeStringEqual } from "./timing-safe-token.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(SecurityAuditService)
    private readonly audit: SecurityAuditService,
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(RateLimitService)
    private readonly rateLimit: RateLimitService,
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const email = body.email.toLowerCase();
    const rateLimitKey = `login:${request.ip}:${email}`;
    this.rateLimit.assertAllowed(rateLimitKey);

    try {
      const user = await this.authService.validateCredentials(
        email,
        body.password,
      );
      const token = await this.authService.signToken(user);
      this.setAuthCookie(response, token);
      this.rateLimit.reset(rateLimitKey);
      await this.audit.record({
        eventType: AuditEventType.LOGIN_SUCCESS,
        userId: user.id,
        email,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return { user };
    } catch (error) {
      await this.audit.record({
        eventType: AuditEventType.LOGIN_FAILURE,
        email,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      });
      throw error;
    }
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.values.nodeEnv === "production",
      path: "/",
    });
    await this.audit.record({
      eventType: AuditEventType.LOGOUT,
      userId: user.id,
      email: user.email,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { ok: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Post("bootstrap/super-admin")
  @HttpCode(201)
  async bootstrapSuperAdmin(
    @Body() body: BootstrapAdminDto,
    @Headers("x-admin-setup-token") setupToken: string | undefined,
    @Req() request: Request,
  ) {
    const rateLimitKey = `setup:${request.ip}`;
    this.rateLimit.assertAllowed(rateLimitKey);

    if (!timingSafeStringEqual(setupToken, this.config.values.adminSetupToken)) {
      throw new ForbiddenException("Token de setup invalido");
    }

    const user = await this.authService.createFirstSuperAdmin({
      name: body.name,
      email: body.email,
      password: body.password,
    });

    await this.audit.record({
      eventType: AuditEventType.ADMIN_BOOTSTRAP,
      userId: user.id,
      email: user.email,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return { user };
  }

  @Get("admin-check")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  adminCheck() {
    return { ok: true };
  }

  @Post("users")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN)
  async createAdminUser(@Body() body: CreateAdminUserDto) {
    const user = await this.authService.createAdministrativeUser({
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
    });

    return { user };
  }

  @Get("operational-check")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.SECRETARIA)
  operationalCheck() {
    return { ok: true };
  }

  private setAuthCookie(response: Response, token: string): void {
    response.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.values.nodeEnv === "production",
      path: "/",
      maxAge: 2 * 60 * 60 * 1000,
    });
  }
}
