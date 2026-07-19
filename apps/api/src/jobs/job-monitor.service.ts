import { Injectable } from "@nestjs/common";

export type JobLastError = {
  at: string;
  type: string;
  message: string;
};

export type JobStatus = {
  name: string;
  enabled: boolean;
  registered: boolean;
  intervalMs: number;
  tickCount: number;
  lastTickAt: string | null;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  nextRunEstimatedAt: string | null;
  running: boolean;
  lastError: JobLastError | null;
};

type JobState = {
  name: string;
  enabled: boolean;
  registered: boolean;
  intervalMs: number;
  tickCount: number;
  lastTickAt: Date | null;
  lastRunStartedAt: Date | null;
  lastRunFinishedAt: Date | null;
  running: boolean;
  lastError: JobLastError | null;
};

@Injectable()
export class JobMonitorService {
  private readonly startedAt = Date.now();
  private readonly jobs = new Map<string, JobState>();

  registerJob(input: {
    name: string;
    enabled: boolean;
    registered: boolean;
    intervalMs: number;
  }) {
    const current = this.jobs.get(input.name);
    this.jobs.set(input.name, {
      name: input.name,
      enabled: input.enabled,
      registered: input.registered,
      intervalMs: input.intervalMs,
      tickCount: current?.tickCount ?? 0,
      lastTickAt: current?.lastTickAt ?? null,
      lastRunStartedAt: current?.lastRunStartedAt ?? null,
      lastRunFinishedAt: current?.lastRunFinishedAt ?? null,
      running: current?.running ?? false,
      lastError: current?.lastError ?? null,
    });
  }

  markRegistered(name: string, registered: boolean) {
    const job = this.jobs.get(name);
    if (job) {
      job.registered = registered;
    }
  }

  recordTick(name: string) {
    const job = this.jobs.get(name);
    if (!job) {
      return;
    }
    job.tickCount += 1;
    job.lastTickAt = new Date();
  }

  recordRunStarted(name: string) {
    const job = this.jobs.get(name);
    if (!job) {
      return;
    }
    job.running = true;
    job.lastRunStartedAt = new Date();
  }

  recordRunFinished(name: string) {
    const job = this.jobs.get(name);
    if (!job) {
      return;
    }
    job.running = false;
    job.lastRunFinishedAt = new Date();
  }

  recordRunError(name: string, error: unknown) {
    const job = this.jobs.get(name);
    if (!job) {
      return;
    }
    const now = new Date();
    job.running = false;
    job.lastRunFinishedAt = now;
    job.lastError = {
      at: now.toISOString(),
      type: error instanceof Error ? error.name : typeof error,
      message: this.safeErrorMessage(error),
    };
  }

  getStatus() {
    return {
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      pid: process.pid,
      jobs: Array.from(this.jobs.values())
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((job) => this.toStatus(job)),
    };
  }

  private toStatus(job: JobState): JobStatus {
    return {
      name: job.name,
      enabled: job.enabled,
      registered: job.registered,
      intervalMs: job.intervalMs,
      tickCount: job.tickCount,
      lastTickAt: job.lastTickAt?.toISOString() ?? null,
      lastRunStartedAt: job.lastRunStartedAt?.toISOString() ?? null,
      lastRunFinishedAt: job.lastRunFinishedAt?.toISOString() ?? null,
      nextRunEstimatedAt: this.nextRunEstimatedAt(job),
      running: job.running,
      lastError: job.lastError,
    };
  }

  private nextRunEstimatedAt(job: JobState) {
    if (!job.enabled || !job.registered || !job.lastTickAt) {
      return null;
    }
    return new Date(job.lastTickAt.getTime() + job.intervalMs).toISOString();
  }

  private safeErrorMessage(error: unknown) {
    const raw = error instanceof Error ? error.message : "Falha inesperada";
    return raw
      .replace(/(token|secret|password|api[_-]?key)=\S+/gi, "$1=[redacted]")
      .slice(0, 500);
  }
}
