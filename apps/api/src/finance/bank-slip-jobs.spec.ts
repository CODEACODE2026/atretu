import assert from "node:assert/strict";
import { BankSlipIssueBatchJob } from "./bank-slip-issue-batch.job.js";
import { BankSlipSyncJob } from "./bank-slip-sync.job.js";
import type { SicrediConfig } from "./sicredi-config.js";

const baseConfig: SicrediConfig = {
  environment: "sandbox",
  authUrl: "https://api-parceiro.sicredi.com.br/sb/auth/openapi/token",
  baseUrl: "https://api-parceiro.sicredi.com.br/sb",
  apiKey: "api-key",
  username: "123456789",
  password: "password",
  cooperativa: "6789",
  posto: "03",
  codigoBeneficiario: "12345",
  timeoutMs: 10_000,
  requirePayerAddress: false,
  syncOpenIssuedEnabled: false,
  syncOpenIssuedIntervalMs: 900_000,
  syncOpenIssuedLimit: 50,
  issueBatchEnabled: false,
  issueBatchIntervalMs: 60_000,
  issueBatchConcurrency: 2,
  issueBatchLimit: 20,
};

class FakeSchedulerRegistry {
  intervals: Array<{ name: string; interval: NodeJS.Timeout }> = [];

  addInterval(name: string, interval: NodeJS.Timeout) {
    this.intervals.push({ name, interval });
    clearInterval(interval);
  }
}

class FakeBankSlipsService {
  syncOpenIssuedCalls = 0;
  processIssueBatchQueueCalls = 0;

  async syncOpenIssued() {
    this.syncOpenIssuedCalls += 1;
    return { id: "manual-sync-run" };
  }

  async processIssueBatchQueue() {
    this.processIssueBatchQueueCalls += 1;
    return { processed: 0, skipped: false };
  }
}

function createSyncJob(config: Partial<SicrediConfig> = {}) {
  const service = new FakeBankSlipsService();
  const scheduler = new FakeSchedulerRegistry();
  const job = new BankSlipSyncJob(
    service as never,
    { ...baseConfig, ...config },
    scheduler as never,
  );
  return { job, scheduler, service };
}

function createIssueBatchJob(config: Partial<SicrediConfig> = {}) {
  const service = new FakeBankSlipsService();
  const scheduler = new FakeSchedulerRegistry();
  const job = new BankSlipIssueBatchJob(
    service as never,
    { ...baseConfig, ...config },
    scheduler as never,
  );
  return { job, scheduler, service };
}

{
  const { job, scheduler, service } = createSyncJob();
  job.onModuleInit();
  assert.equal(scheduler.intervals.length, 0);
  assert.equal(service.syncOpenIssuedCalls, 0);
}

{
  const { job, scheduler, service } = createSyncJob({ syncOpenIssuedEnabled: false });
  job.onModuleInit();
  assert.equal(scheduler.intervals.length, 0);
  assert.equal(service.syncOpenIssuedCalls, 0);
}

{
  const { job, scheduler } = createSyncJob({ syncOpenIssuedEnabled: true });
  job.onModuleInit();
  assert.equal(scheduler.intervals.length, 1);
  assert.equal(scheduler.intervals[0]?.name, "sicredi-open-issued-sync");
}

{
  const { job, scheduler, service } = createIssueBatchJob();
  job.onModuleInit();
  assert.equal(scheduler.intervals.length, 0);
  assert.equal(service.processIssueBatchQueueCalls, 0);
}

{
  const { job, scheduler, service } = createIssueBatchJob({ issueBatchEnabled: false });
  job.onModuleInit();
  assert.equal(scheduler.intervals.length, 0);
  assert.equal(service.processIssueBatchQueueCalls, 0);
}

{
  const { job, scheduler } = createIssueBatchJob({ issueBatchEnabled: true });
  job.onModuleInit();
  assert.equal(scheduler.intervals.length, 1);
  assert.equal(scheduler.intervals[0]?.name, "sicredi-bank-slip-issue-batch");
}

{
  const { job, scheduler, service } = createSyncJob();
  job.onModuleInit();
  await service.syncOpenIssued();
  assert.equal(scheduler.intervals.length, 0);
  assert.equal(service.syncOpenIssuedCalls, 1);
}
