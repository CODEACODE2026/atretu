import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service.js";

type AttemptBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  ttlMs?: number;
  max?: number;
};

export class RateLimitExceededException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super("Muitas tentativas. Tente novamente depois.", HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, AttemptBucket>();

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  assertAllowed(key: string, options: RateLimitOptions = {}): void {
    const now = Date.now();
    const ttl = options.ttlMs ?? this.config.values.authRateLimitTtlMs;
    const max = options.max ?? this.config.values.authRateLimitMax;
    this.pruneExpired(now);
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      this.pruneOldestIfNeeded();
      this.buckets.set(key, { count: 1, resetAt: now + ttl });
      return;
    }

    if (current.count >= max) {
      throw new RateLimitExceededException(Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
    }

    current.count += 1;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  get size(): number {
    return this.buckets.size;
  }

  private pruneExpired(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private pruneOldestIfNeeded(): void {
    const maxBuckets = this.config.values.rateLimitMaxBuckets;
    while (this.buckets.size >= maxBuckets) {
      const oldestKey = this.buckets.keys().next().value as string | undefined;
      if (!oldestKey) {
        return;
      }
      this.buckets.delete(oldestKey);
    }
  }
}
