import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import { ReapplyAffiliateRuleUseCase } from "../../application/use-cases/reapply-affiliate-rule.usecase";

/**
 * Worker consume queue affiliate.reapply — chay qua pg-boss thay vi dong bo
 * trong request (dichoithoi-affiliate-link-conversion-spec.md §4, Phase 3
 * build item 3: "Job 'Áp dụng lại' (pg-boss)"). Cung pattern voi
 * hotel.auto-assign/destination.relink — fire-and-forget, UI hien toast
 * "Đã đưa vào hàng đợi" thay vi cho ket qua tong hop ngay lap tuc.
 */
@Injectable()
export class ReapplyAffiliateRuleWorker implements OnModuleInit {
  private readonly logger = new Logger(ReapplyAffiliateRuleWorker.name);

  constructor(
    private readonly pgBoss: PgBossService,
    private readonly reapply: ReapplyAffiliateRuleUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.affiliateReapply, async (data) => {
      const { ruleId } = data as { ruleId: string | null };
      const report = await this.reapply.execute(ruleId);
      this.logger.log(
        `Ap dung lai rule ${ruleId ?? "(toan bo)"}: cap nhat ${report.totalUpdated} link ` +
          `(${report.targets.map((t) => `${t.label}: ${t.updatedCount}`).join(", ")})`,
      );
    });
  }
}
