import { Injectable } from "@nestjs/common";
import type { ReapplyAffiliateRuleReport } from "@zinoflow/contracts";
import { AffiliateReapplyRegistry } from "../services/affiliate-reapply-registry.service";

/**
 * Nut "Áp dụng lại" (spec §4): quet moi module da dang ky (destination/hotel/tour),
 * moi module tu tinh lai affiliateUrl cho link cua no va publish lai. Idempotent —
 * chay 2 lan lien tiep khong doi them gi (tung target tu dam bao dieu nay).
 */
@Injectable()
export class ReapplyAffiliateRuleUseCase {
  constructor(private readonly registry: AffiliateReapplyRegistry) {}

  async execute(ruleId: string | null): Promise<ReapplyAffiliateRuleReport> {
    const startedAt = Date.now();
    const targets = [];
    let totalUpdated = 0;
    for (const target of this.registry.list()) {
      const { updatedCount } = await target.reapply(ruleId);
      targets.push({ label: target.label, updatedCount });
      totalUpdated += updatedCount;
    }
    return { ruleId, targets, totalUpdated, durationMs: Date.now() - startedAt };
  }
}
