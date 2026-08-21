import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { RoleCode, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppConfigService } from "../config/app-config.service.js";
import { assertPasswordPolicy } from "../users/password-policy.js";
import { UsersService, type AuthUser } from "../users/users.service.js";

export type JwtPayload = {
  sub: string;
  email: string;
  roles: RoleCode[];
  passwordChangedAt?: number | null;
  iat?: number;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(AppConfigService)
    private readonly config: AppConfigService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.values.passwordHashRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    const passwordMatches = await this.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    await this.usersService.markLogin(user.id);

    return this.usersService.toAuthUser(user);
  }

  async createFirstSuperAdmin(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<AuthUser> {
    assertPasswordPolicy({
      password: input.password,
      email: input.email,
      name: input.name,
    });
    const superAdmins = await this.usersService.countSuperAdmins();
    if (superAdmins > 0) {
      throw new ConflictException("Super Admin inicial ja existe");
    }

    return this.usersService.createUserWithRole({
      name: input.name,
      email: input.email,
      passwordHash: await this.hashPassword(input.password),
      role: RoleCode.SUPER_ADMIN,
    });
  }

  async signToken(user: AuthUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
    };

    return this.jwtService.signAsync(payload);
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token);
  }
}
