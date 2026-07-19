import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { JobMonitorService } from "../jobs/job-monitor.service.js";
import { BankSlipsService, SICREDI_CONFIG } from "./bank-slips.service.js";
import type { SicrediConfig } from "./sicredi-config.js";

const JOB_NAME = "sicredi-bank-slip-issue-batch";
const MONITOR_JOB_NAME = "sicredi_issue_batch";

@Injectable()
export class BankSlipIssueBatchJob implements OnModuleInit {
  private readonly logger = new Logger(BankSlipIssueBatchJob.name);

  constructor(
    @Inject(BankSlipsService) private readonly bankSlips: BankSlipsService,
    @Inject(SICREDI_CONFIG) private readonly sicrediConfig: SicrediConfig,
    @Inject(SchedulerRegistry) private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(JobMonitorService) private readonly jobMonitor: JobMonitorService,
  ) {}

  onModuleInit() {
    this.jobMonitor.registerJob({
      name: MONITOR_JOB_NAME,
      enabled: this.sicrediConfig.issueBatchEnabled,
      registered: false,
      intervalMs: this.sicrediConfig.issueBatchIntervalMs,
    });
    if (!this.sicrediConfig.issueBatchEnabled) {
      this.logger.log({
        event: "sicredi_bank_slip_issue_batch_disabled",
        enabled: false,
      });
      return;
    }

    const interval = setInterval(() => {
      this.jobMonitor.recordTick(MONITOR_JOB_NAME);
      void this.run();
    }, this.sicrediConfig.issueBatchIntervalMs);
    this.schedulerRegistry.addInterval(JOB_NAME, interval);
    this.jobMonitor.markRegistered(MONITOR_JOB_NAME, true);
    this.logger.log({
      event: "sicredi_bank_slip_issue_batch_scheduled",
      enabled: true,
      intervalMs: this.sicrediConfig.issueBatchIntervalMs,
      limit: this.sicrediConfig.issueBatchLimit,
    });
  }

  private async run() {
    this.jobMonitor.recordRunStarted(MONITOR_JOB_NAME);
    try {
      await this.bankSlips.processIssueBatchQueue();
      this.jobMonitor.recordRunFinished(MONITOR_JOB_NAME);
    } catch (error) {
      this.jobMonitor.recordRunError(MONITOR_JOB_NAME, error);
      this.logger.error({
        event: "sicredi_bank_slip_issue_batch_failed",
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}
