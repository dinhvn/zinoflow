import { Inject, Injectable } from "@nestjs/common";
import type { ResolveAffiliateLinkResponse } from "@zinoflow/contracts";
import { resolveAffiliateLink } from "../../domain/affiliate-link-rule";
import {
  AFFILIATE_NETWORK_REPOSITORY,
  type AffiliateNetworkRepository,
} from "../ports/affiliate-network.repository";
import {
  AFFILIATE_PARTNER_REPOSITORY,
  type AffiliatePartnerRepository,
} from "../ports/affiliate-partner.repository";

/**
 * Preview/convert sourceUrl -> affiliateUrl (doc phan tich §3, thuat toan v2). Dung
 * ca cho preview form (chua luu) lan luc publisher cac module khac ghi
 * TicketLinksJson/Hotel/Tour.
 */
@Injectable()
export class ResolveAffiliateLinkUseCase {
  constructor(
    @Inject(AFFILIATE_PARTNER_REPOSITORY) private readonly partners: AffiliatePartnerRepository,
    @Inject(AFFILIATE_NETWORK_REPOSITORY) private readonly networks: AffiliateNetworkRepository,
  ) {}

  async execute(sourceUrl: string, provider: string | null = null): Promise<ResolveAffiliateLinkResponse> {
    const [activePartners, activeNetworks] = await Promise.all([
      this.partners.listActive(),
      this.networks.listActive(),
    ]);
    return resolveAffiliateLink(sourceUrl, activePartners, activeNetworks, provider);
  }
}
