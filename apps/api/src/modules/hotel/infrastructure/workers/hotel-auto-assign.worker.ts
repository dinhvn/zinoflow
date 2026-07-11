import { Injectable, OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { AutoAssignHotelsByDistanceUseCase } from "../../application/use-cases/auto-assign-hotels-by-distance.usecase";

/**
 * Worker consume queue hotel.auto-assign — recompute TOAN BO khach san moi
 * lan chay (so luong hotel hien tai con nho, chua can targeted-by-id). Neu
 * khoi luong lon len dang ke, can doi sang nhan hotelId/destinationSlug trong
 * job data de chi tinh lai phan lien quan.
 *
 * Luu y: job nay CHUA duoc trigger tu dong khi 1 diem den doi toa do (chieu
 * nguoc cua hotel-spec §5 job 3) — moi co trigger khi tao hotel moi
 * (upsert-hotel.usecase.ts) va nut tay tren UI. Neu doi toa do diem den anh
 * huong hotel dang gan, bam nut "Tính lại gán tự động" o man Khach san.
 */
@Injectable()
export class HotelAutoAssignWorker implements OnModuleInit {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly autoAssign: AutoAssignHotelsByDistanceUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.hotelAutoAssign, async () => {
      await this.autoAssign.execute();
    });
  }
}
