import { Injectable, OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { RelinkAllUseCase } from "../../application/use-cases/relink-all.usecase";

/**
 * Worker consume queue destination.relink — chay THAT (dryRun=false) qua
 * pg-boss thay vi dong bo trong request (spec dichoithoi-destination-spec §12.2,
 * Phase 2 build item 3: "pg-boss worker relink"). Xem truoc (dryRun=true) van
 * dong bo qua POST /destinations/relink — chi la doc bao cao, khong ghi, khong
 * can qua queue; nut "Ap dung" tren UI goi POST /destinations/relink/apply
 * (fire-and-forget, cung pattern voi hotel.auto-assign).
 */
@Injectable()
export class RelinkAllWorker implements OnModuleInit {
  constructor(
    private readonly pgBoss: PgBossService,
    private readonly relinkAll: RelinkAllUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.destinationRelink, async () => {
      await this.relinkAll.execute(false);
    });
  }
}
