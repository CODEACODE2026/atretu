import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { BankSlipsService, SICREDI_CONFIG } from "./bank-slips.service.js";
import type { SicrediConfig } from "./sicredi-config.js";

const JOB_NAME = "sicredi-bank-slip-issue-batch";

@Injectable()
export class BankSlipIssueBatchJob implements OnModuleInit {
  private readonly logger = new Logger(BankSlipIssueBatchJob.name);

  constructor(
    @Inject(BankSlipsService) private readonly bankSlips: BankSlipsService,
    @Inject(SICREDI_CONFIG) private readonly sicrediConfig: SicrediConfig,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const interval = setInterval(() => {
      void this.run();
    }, this.sicrediConfig.issueBatchIntervalMs);
    this.schedulerRegistry.addInterval(JOB_NAME, interval);
    this.logger.log({
      event: "sicredi_bank_slip_issue_batch_scheduled",
      intervalMs: this.sicrediConfig.issueBatchIntervalMs,
      concurrency: this.sicrediConfig.issueBatchConcurrency,
      limit: this.sicrediConfig.issueBatchLimit,
    });
  }

  private async run() {
    try {
      await this.bankSlips.processIssueBatchQueue();
    } catch (error) {
      this.logger.error({
        event: "sicredi_bank_slip_issue_batch_failed",
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
