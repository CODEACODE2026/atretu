import { Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { AppConfigService } from "../config/app-config.service.js";
import { SecurityModule } from "../security/security.module.js";
import { AccountController } from "../users/account.controller.js";
import { AdminUsersController } from "../users/admin-users.controller.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { PermissionGuard } from "./permission.guard.js";
import { RolesGuard } from "./roles.guard.js";

@Module({
  imports: [
    UsersModule,
    SecurityModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.values.jwtSecret,
        signOptions: {
          expiresIn: config.values.jwtExpiresIn as JwtSignOptions["expiresIn"],
        },
      }),
    }),
  ],
  controllers: [AuthController, AccountController, AdminUsersController],
  providers: [AuthService, AuthGuard, PermissionGuard, RolesGuard],
  exports: [AuthService, AuthGuard, PermissionGuard, RolesGuard],
})
export class AuthModule {}
