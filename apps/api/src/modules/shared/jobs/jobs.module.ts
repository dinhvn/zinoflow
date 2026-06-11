import { Global, Module } from "@nestjs/common";
import { JOB_QUEUE } from "./job-queue.port";
import { PgBossService } from "./pg-boss.service";
import { SystemJobsController } from "./system-jobs.controller";

/**
 * Global module: moi module khac inject JOB_QUEUE (port) hoac PgBossService
 * (de registerWorker) ma khong can import lai.
 */
@Global()
@Module({
  controllers: [SystemJobsController],
  providers: [PgBossService, { provide: JOB_QUEUE, useExisting: PgBossService }],
  exports: [PgBossService, JOB_QUEUE],
})
export class JobsModule {}
