import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { SecurityModule } from "../security/security.module.js";
import { UsersModule } from "../users/users.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
  imports: [AuthModule, DatabaseModule, FinanceModule, SecurityModule, UsersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
