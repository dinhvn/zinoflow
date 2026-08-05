import { Injectable, OnModuleInit } from "@nestjs/common";
import { runGeocodeBatchRequestSchema } from "@zinoflow/contracts";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { ProcessGeocodeBatchUseCase } from "../../application/use-cases/process-geocode-batch.usecase";

/**
 * Worker consume queue destination.geocode-batch — chay vong lap goi Google
 * Places THAT qua pg-boss thay vi dong bo trong request (dichoithoi-
 * destination-geocode-audit-plan.md Giai doan 1b), cung pattern voi
 * RelinkAllWorker. Enqueue tu RunGeocodeBatchUseCase (fire-and-forget).
 */
@Injectable()
export class GeocodeBatchWorker implements OnModuleInit {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly processGeocodeBatch: ProcessGeocodeBatchUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.destinationGeocodeBatch, async (data) => {
      const payload = runGeocodeBatchRequestSchema.parse(data);
      await this.processGeocodeBatch.execute(payload);
    });
  }
}
