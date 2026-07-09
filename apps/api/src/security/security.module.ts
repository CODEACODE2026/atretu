import { Module } from "@nestjs/common";
import { RateLimitService } from "./rate-limit.service.js";
import { SecurityAuditService } from "./security-audit.service.js";

@Module({
  providers: [RateLimitService, SecurityAuditService],
  exports: [RateLimitService, SecurityAuditService],
})
export class SecurityModule {}
