import { Injectable, OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { RefreshWebResultsBatchUseCase } from "../../application/use-cases/refresh-web-results-batch.usecase";

/**
 * Worker consume queue destination.refresh-web-results — cung pattern voi
 * GeocodeBatchWorker. Payload rong (khong tham so, luon vet TOAN BO diem
 * "accepted" con thieu "Ket qua tren web").
 */
@Injectable()
export class RefreshWebResultsWorker implements OnModuleInit {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly refreshWebResultsBatch: RefreshWebResultsBatchUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.destinationRefreshWebResults, async () => {
      await this.refreshWebResultsBatch.execute();
    });
  }
}
