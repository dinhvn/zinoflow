import { Controller, Logger, OnModuleInit, Post } from "@nestjs/common";
import { QUEUE_NAMES } from "./job-queue.port";
import { PgBossService } from "./pg-boss.service";

/**
 * Endpoint test cho job queue (Day 2 DoD: pg-boss nhan va xu ly duoc job).
 * POST /api/system/jobs/ping -> enqueue 1 ping job, worker log khi xu ly.
 */
@Controller("system/jobs")
export class SystemJobsController implements OnModuleInit {
  private readonly logger = new Logger(SystemJobsController.name);

  constructor(private readonly pgBoss: PgBossService) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.systemPing, async (data) => {
      this.logger.log(`PING job processed: ${JSON.stringify(data)}`);
    });
  }

  @Post("ping")
  async ping(): Promise<{ jobId: string | null }> {
    const jobId = await this.pgBoss.send(QUEUE_NAMES.systemPing, {
      sentAt: new Date().toISOString(),
    });
    return { jobId };
  }
}
