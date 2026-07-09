import { Inject, Injectable } from "@nestjs/common";
import { AuditEventType } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class SecurityAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: {
    eventType: AuditEventType;
    userId?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void> {
    await this.prisma.securityAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        email: input.email?.toLowerCase(),
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 255),
        metadata: input.metadata,
      },
    });
  }
}
