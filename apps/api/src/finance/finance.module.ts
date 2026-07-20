import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AdministrativeAuditModule } from "../administrative-audit/administrative-audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { UsersModule } from "../users/users.module.js";
import { BankSlipIssueBatchJob } from "./bank-slip-issue-batch.job.js";
import { BankSlipPdfStorage } from "./bank-slip-pdf-storage.js";
import { BankSlipsController } from "./bank-slips.controller.js";
import { BankSlipSyncJob } from "./bank-slip-sync.job.js";
import {
  BankSlipsService,
  SICREDI_CLIENT,
  SICREDI_CONFIG,
} from "./bank-slips.service.js";
import { InvoicesController } from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { SicrediClient } from "./sicredi-client.js";
import { loadSicrediConfig } from "./sicredi-config.js";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AdministrativeAuditModule,
    AuthModule,
    DatabaseModule,
    JobsModule,
    UsersModule,
  ],
  controllers: [InvoicesController, BankSlipsController],
  providers: [
    InvoicesService,
    BankSlipsService,
    BankSlipPdfStorage,
    BankSlipIssueBatchJob,
    BankSlipSyncJob,
    {
      provide: SICREDI_CONFIG,
      useFactory: () => loadSicrediConfig(),
    },
    {
      provide: SICREDI_CLIENT,
      useFactory: (config: ReturnType<typeof loadSicrediConfig>) =>
        new SicrediClient(config),
      inject: [SICREDI_CONFIG],
    },
  ],
  exports: [InvoicesService, BankSlipsService],
})
export class FinanceModule {}
