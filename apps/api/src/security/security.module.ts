import { Module } from "@nestjs/common";
import { OperationalRateLimitGuard } from "./operational-rate-limit.guard.js";
import { RateLimitService } from "./rate-limit.service.js";
import { SecurityAuditService } from "./security-audit.service.js";

@Module({
  providers: [OperationalRateLimitGuard, RateLimitService, SecurityAuditService],
  exports: [OperationalRateLimitGuard, RateLimitService, SecurityAuditService],
})
export class SecurityModule {}
