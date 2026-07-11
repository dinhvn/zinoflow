import { Injectable, OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { IngestTourImagesUseCase } from "../../application/use-cases/ingest-tour-images.usecase";

interface TourImageIngestJobData {
  tourId: string;
}

/**
 * Worker consume queue tour.image-ingest (Phase 21.3, audit 07/2026) — chay
 * ngay sau khi UpsertTourUseCase publish xong voi URL anh hien co (co the la
 * URL ngoai). Job tai ve/resize/FTP anh roi ghi de + publish lai, khong lam
 * cham request tao/sua tour. Cung pattern voi HotelImageIngestWorker.
 */
@Injectable()
export class TourImageIngestWorker implements OnModuleInit {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly ingestImages: IngestTourImagesUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.tourImageIngest, async (data) => {
      const { tourId } = data as TourImageIngestJobData;
      await this.ingestImages.execute(tourId);
    });
  }
}
