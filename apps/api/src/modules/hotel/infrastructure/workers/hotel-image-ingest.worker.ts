import { Injectable, OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { IngestHotelImagesUseCase } from "../../application/use-cases/ingest-hotel-images.usecase";

interface HotelImageIngestJobData {
  hotelId: string;
}

/**
 * Worker consume queue hotel.image-ingest (Phase 21.3, audit 07/2026) — chay
 * ngay sau khi UpsertHotelUseCase publish xong voi URL anh hien co (co the la
 * URL ngoai). Job tai ve/resize/FTP anh roi ghi de + publish lai, khong lam
 * cham request tao/sua khach san.
 */
@Injectable()
export class HotelImageIngestWorker implements OnModuleInit {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly ingestImages: IngestHotelImagesUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.hotelImageIngest, async (data) => {
      const { hotelId } = data as HotelImageIngestJobData;
      await this.ingestImages.execute(hotelId);
    });
  }
}
