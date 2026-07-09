import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service.js";

type AttemptBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, AttemptBucket>();

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  assertAllowed(key: string): void {
    const now = Date.now();
    const ttl = this.config.values.authRateLimitTtlMs;
    const max = this.config.values.authRateLimitMax;
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + ttl });
      return;
    }

    if (current.count >= max) {
      throw new HttpException(
        "Muitas tentativas. Tente novamente depois.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
