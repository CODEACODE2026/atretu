import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { BankSlipsService, SICREDI_CONFIG } from "./bank-slips.service.js";
import type { SicrediConfig } from "./sicredi-config.js";

const JOB_NAME = "sicredi-open-issued-sync";

@Injectable()
export class BankSlipSyncJob implements OnModuleInit {
  private readonly logger = new Logger(BankSlipSyncJob.name);

  constructor(
    @Inject(BankSlipsService) private readonly bankSlips: BankSlipsService,
    @Inject(SICREDI_CONFIG) private readonly sicrediConfig: SicrediConfig,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    if (!this.sicrediConfig.syncOpenIssuedEnabled) {
      this.logger.log({
        event: "sicredi_open_issued_sync_disabled",
        enabled: false,
      });
      return;
    }

    const interval = setInterval(() => {
      this.logger.log({
        event: "sicredi_open_issued_sync_tick",
        intervalMs: this.sicrediConfig.syncOpenIssuedIntervalMs,
        limit: this.sicrediConfig.syncOpenIssuedLimit,
      });
      void this.run();
    }, this.sicrediConfig.syncOpenIssuedIntervalMs);
    this.schedulerRegistry.addInterval(JOB_NAME, interval);
    this.logger.log({
      event: "sicredi_open_issued_sync_scheduled",
      enabled: true,
      intervalMs: this.sicrediConfig.syncOpenIssuedIntervalMs,
      limit: this.sicrediConfig.syncOpenIssuedLimit,
    });
  }

  private async run() {
    try {
      await this.bankSlips.syncOpenIssued();
    } catch (error) {
      this.logger.error({
        event: "sicredi_open_issued_sync_job_failed",
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
