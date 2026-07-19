import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { JobMonitorService } from "../jobs/job-monitor.service.js";
import { BankSlipsService, SICREDI_CONFIG } from "./bank-slips.service.js";
import type { SicrediConfig } from "./sicredi-config.js";

const JOB_NAME = "sicredi-open-issued-sync";
const MONITOR_JOB_NAME = "sicredi_open_issued_sync";

@Injectable()
export class BankSlipSyncJob implements OnModuleInit {
  private readonly logger = new Logger(BankSlipSyncJob.name);

  constructor(
    @Inject(BankSlipsService) private readonly bankSlips: BankSlipsService,
    @Inject(SICREDI_CONFIG) private readonly sicrediConfig: SicrediConfig,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(JobMonitorService) private readonly jobMonitor: JobMonitorService,
  ) {}

  onModuleInit() {
    this.jobMonitor.registerJob({
      name: MONITOR_JOB_NAME,
      enabled: this.sicrediConfig.syncOpenIssuedEnabled,
      registered: false,
      intervalMs: this.sicrediConfig.syncOpenIssuedIntervalMs,
    });
    if (!this.sicrediConfig.syncOpenIssuedEnabled) {
      this.logger.log({
        event: "sicredi_open_issued_sync_disabled",
        enabled: false,
      });
      return;
    }

    const interval = setInterval(() => {
      this.jobMonitor.recordTick(MONITOR_JOB_NAME);
      this.logger.log({
        event: "sicredi_open_issued_sync_tick",
        intervalMs: this.sicrediConfig.syncOpenIssuedIntervalMs,
        limit: this.sicrediConfig.syncOpenIssuedLimit,
      });
      void this.run();
    }, this.sicrediConfig.syncOpenIssuedIntervalMs);
    this.schedulerRegistry.addInterval(JOB_NAME, interval);
    this.jobMonitor.markRegistered(MONITOR_JOB_NAME, true);
    this.logger.log({
      event: "sicredi_open_issued_sync_scheduled",
      enabled: true,
      intervalMs: this.sicrediConfig.syncOpenIssuedIntervalMs,
      limit: this.sicrediConfig.syncOpenIssuedLimit,
    });
  }

  private async run() {
    this.jobMonitor.recordRunStarted(MONITOR_JOB_NAME);
    try {
      await this.bankSlips.syncOpenIssued();
      this.jobMonitor.recordRunFinished(MONITOR_JOB_NAME);
    } catch (error) {
      this.jobMonitor.recordRunError(MONITOR_JOB_NAME, error);
      this.logger.error({
        event: "sicredi_open_issued_sync_job_failed",
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
