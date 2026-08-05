import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserStatus } from "@prisma/client";
import type { Request } from "express";
import { ALLOW_DURING_PASSWORD_CHANGE_KEY } from "./allow-during-password-change.decorator.js";
import { AUTH_COOKIE_NAME } from "./auth.constants.js";
import { AuthService } from "./auth.service.js";
import { UsersService, type AuthUser } from "../users/users.service.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
    @Optional()
    @Inject(Reflector)
    private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = this.getToken(request);

    if (!token) {
      throw new UnauthorizedException("Autenticacao obrigatoria");
    }

    const payload = await this.authService.verifyToken(token);
    const user = await this.usersService.findAuthUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException("Autenticacao invalida");
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Autenticacao invalida");
    }
    if (
      this.isTokenInvalidatedByPasswordChange(
        payload.passwordChangedAt,
        payload.iat,
        user.passwordChangedAt,
      )
    ) {
      throw new UnauthorizedException("Autenticacao invalida");
    }

    request.user = user;
    if (user.mustChangePassword && !this.isAllowedDuringPasswordChange(context)) {
      throw new ForbiddenException("Troca de senha obrigatoria");
    }
    return true;
  }

  private isAllowedDuringPasswordChange(context: ExecutionContext): boolean {
    return (
      this.reflector?.getAllAndOverride<boolean>(
        ALLOW_DURING_PASSWORD_CHANGE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? false
    );
  }

  private isTokenInvalidatedByPasswordChange(
    tokenPasswordChangedAt: number | null | undefined,
    issuedAtSeconds: number | undefined,
    passwordChangedAt: Date | null | undefined,
  ): boolean {
    if (!passwordChangedAt) {
      return false;
    }
    if (tokenPasswordChangedAt !== undefined) {
      return tokenPasswordChangedAt !== passwordChangedAt.getTime();
    }
    if (!issuedAtSeconds) {
      return true;
    }

    // JWT iat has second precision; keep a one-second tolerance so a token
    // issued immediately after a password change is not rejected by milliseconds.
    return issuedAtSeconds * 1000 + 999 < passwordChangedAt.getTime();
  }

  private getToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined>;
    const cookieToken = cookies?.[AUTH_COOKIE_NAME];
    if (cookieToken) {
      return cookieToken;
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return undefined;
    }

    return authorization.slice("Bearer ".length);
  }
}
