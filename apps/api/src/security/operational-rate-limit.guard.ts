import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthUser } from "../users/users.service.js";
import { RateLimitService, type RateLimitOptions } from "./rate-limit.service.js";

type RateLimitAudience = "ip" | "user";

export type OperationalRateLimitPolicy = RateLimitOptions & {
  audience: RateLimitAudience;
  category: string;
};

export const OPERATIONAL_RATE_LIMIT_KEY = "operationalRateLimit";

export const RATE_LIMITS = {
  publicUpload: { audience: "ip", category: "public-upload", ttlMs: 15 * 60_000, max: 5 },
  search: { audience: "user", category: "search", ttlMs: 60_000, max: 240 },
  download: { audience: "user", category: "download", ttlMs: 60_000, max: 60 },
  pdf: { audience: "user", category: "pdf", ttlMs: 60_000, max: 60 },
  zip: { audience: "user", category: "zip", ttlMs: 5 * 60_000, max: 3 },
  batchCreate: { audience: "user", category: "batch-create", ttlMs: 5 * 60_000, max: 3 },
  batchPoll: { audience: "user", category: "batch-poll", ttlMs: 60_000, max: 120 },
  preview: { audience: "user", category: "preview", ttlMs: 60_000, max: 60 },
  sicrediIssue: { audience: "user", category: "sicredi-issue", ttlMs: 60_000, max: 5 },
  sicrediCancel: { audience: "user", category: "sicredi-cancel", ttlMs: 60_000, max: 5 },
  sicrediSync: { audience: "user", category: "sicredi-sync", ttlMs: 5 * 60_000, max: 10 },
  sicrediPdf: { audience: "user", category: "sicredi-pdf", ttlMs: 60_000, max: 60 },
  technical: { audience: "user", category: "technical", ttlMs: 5 * 60_000, max: 3 },
  upload: { audience: "user", category: "upload", ttlMs: 60_000, max: 20 },
} as const satisfies Record<string, OperationalRateLimitPolicy>;

export function OperationalRateLimit(policy: OperationalRateLimitPolicy) {
  return SetMetadata(OPERATIONAL_RATE_LIMIT_KEY, policy);
}

@Injectable()
export class OperationalRateLimitGuard implements CanActivate {
  constructor(
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<OperationalRateLimitPolicy>(
      OPERATIONAL_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; route?: { path?: string } }>();
    const routeKey = normalizeRouteKey(
      request.method,
      request.route?.path ?? request.path ?? "unknown",
    );
    const subject =
      policy.audience === "user"
        ? `user:${request.user?.id ?? "anonymous"}`
        : `ip:${request.ip ?? "unknown"}`;
    this.rateLimit.assertAllowed(
      `operational:${policy.category}:${routeKey}:${subject}`,
      policy,
    );
    return true;
  }
}

function normalizeRouteKey(method: string | undefined, path: string) {
  const pathWithoutQuery = path.split(/[?#]/, 1)[0] || "unknown";
  return `${method ?? "UNKNOWN"}:${pathWithoutQuery
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ":uuid",
    )
    .replace(/\/+/g, "/")}`;
}
