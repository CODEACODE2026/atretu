import { Inject, Injectable } from "@nestjs/common";
import { AdministrativeAuditEventType } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class AdministrativeAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: {
    eventType: AdministrativeAuditEventType;
    userId?: string;
    domain: string;
    recordId: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<void> {
    await this.prisma.administrativeAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        domain: input.domain,
        recordId: input.recordId,
        metadata: input.metadata,
      },
    });
  }
}
