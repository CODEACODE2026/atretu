import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AUTH_COOKIE_NAME } from "./auth.constants.js";
import { AuthService } from "./auth.service.js";
import { UsersService, type AuthUser } from "../users/users.service.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
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

    request.user = user;
    return true;
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
