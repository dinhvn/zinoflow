import { Inject, Injectable } from "@nestjs/common";
import type { ResolveAffiliateLinkResponse } from "@zinoflow/contracts";
import { resolveAffiliateLink } from "../../domain/affiliate-link-rule";
import {
  AFFILIATE_RULE_REPOSITORY,
  type AffiliateRuleRepository,
} from "../ports/affiliate-rule.repository";

/**
 * Preview/convert sourceUrl -> affiliateUrl (spec §3). Dung ca cho preview form
 * (chua luu) lan luc publisher cac module khac ghi TicketLinksJson/Hotel/Tour.
 */
@Injectable()
export class ResolveAffiliateLinkUseCase {
  constructor(
    @Inject(AFFILIATE_RULE_REPOSITORY) private readonly rules: AffiliateRuleRepository,
  ) {}

  async execute(sourceUrl: string, provider: string | null = null): Promise<ResolveAffiliateLinkResponse> {
    const activeRules = await this.rules.listActive();
    return resolveAffiliateLink(sourceUrl, activeRules, provider);
  }
}
