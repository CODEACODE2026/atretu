import { Inject, Injectable } from "@nestjs/common";
import { AdministrativeAuditEventType, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service.js";

const SENSITIVE_METADATA_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "temporarypassword",
  "temporary_password",
  "passwordhash",
  "password_hash",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "cookie",
  "setcookie",
  "authorization",
  "authorizationheader",
  "secret",
  "jwt",
]);

@Injectable()
export class AdministrativeAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(
    input: {
      eventType: AdministrativeAuditEventType;
      userId?: string;
      domain: string;
      recordId: string;
      metadata?: Prisma.InputJsonObject;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.administrativeAuditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        domain: input.domain,
        recordId: input.recordId,
        metadata: sanitizeAdministrativeAuditMetadata(input.metadata),
      },
    });
  }
}

export function sanitizeAdministrativeAuditMetadata(
  metadata: Prisma.InputJsonObject | undefined,
): Prisma.InputJsonObject | undefined {
  if (!metadata) {
    return metadata;
  }
  return sanitizeJsonValue(metadata) as Prisma.InputJsonObject;
}

function sanitizeJsonValue(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item as Prisma.InputJsonValue));
  }
  if (value && typeof value === "object") {
    const sanitized: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, childValue] of Object.entries(value)) {
      if (isSensitiveMetadataKey(key)) {
        continue;
      }
      sanitized[key] = sanitizeJsonValue(childValue as Prisma.InputJsonValue);
    }
    return sanitized as Prisma.InputJsonObject;
  }
  return value;
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = key.replace(/[-_\s]/g, "").toLowerCase();
  return SENSITIVE_METADATA_KEYS.has(normalized) || normalized.includes("passwordhash");
}
