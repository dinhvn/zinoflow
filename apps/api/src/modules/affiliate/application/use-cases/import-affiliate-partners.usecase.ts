import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ImportAffiliatePartnersResult, ImportAffiliatePartnersRequest } from "@zinoflow/contracts";
import {
  AFFILIATE_PARTNER_REPOSITORY,
  type AffiliatePartnerRepository,
} from "../ports/affiliate-partner.repository";
import {
  AFFILIATE_NETWORK_REPOSITORY,
  type AffiliateNetworkRepository,
} from "../ports/affiliate-network.repository";

/**
 * Import hàng loạt đối tác affiliate từ Google Sheet public (doc phân tích §4) —
 * client tải Sheet + parse CSV, gửi items đã cấu trúc; server upsert theo `code`.
 * LƯU THẲNG, không dry-run/preview (khác pattern Hotel/Tour). Cột "loại
 * affiliate" trong Sheet = `affiliate_networks.code` — khớp CHÍNH XÁC (không
 * fuzzy theo tên); khớp được thì gán/ghi đè networkId, không khớp thì GIỮ
 * nguyên networkId đang có (không tự xoá gán tay đã làm qua dropdown).
 */
@Injectable()
export class ImportAffiliatePartnersUseCase {
  private readonly logger = new Logger(ImportAffiliatePartnersUseCase.name);

  constructor(
    @Inject(AFFILIATE_PARTNER_REPOSITORY) private readonly partners: AffiliatePartnerRepository,
    @Inject(AFFILIATE_NETWORK_REPOSITORY) private readonly networks: AffiliateNetworkRepository,
  ) {}

  async execute(request: ImportAffiliatePartnersRequest): Promise<ImportAffiliatePartnersResult> {
    const allNetworks = await this.networks.listAll();
    const networkIdByCode = new Map(allNetworks.map((n) => [n.code, n.id]));

    let inserted = 0;
    let updated = 0;
    const skipped: Array<{ code: string; reason: string }> = [];

    for (const item of request.items) {
      const code = item.code.trim();
      if (!code) {
        skipped.push({ code: item.code, reason: "Thiếu code" });
        continue;
      }
      try {
        const networkCode = item.networkCode?.trim();
        const resolvedNetworkId = networkCode ? networkIdByCode.get(networkCode) ?? null : null;
        const networkId =
          resolvedNetworkId ?? (await this.partners.findByCode(code))?.networkId ?? null;

        const { created } = await this.partners.upsertByCode(code, {
          name: item.name.trim(),
          homepageUrl: item.homepageUrl?.trim() || null,
          description: item.description?.trim() || null,
          networkId,
          matchDomain: null,
          isActive: item.isActive,
        });
        if (created) inserted++;
        else updated++;
      } catch (err) {
        skipped.push({ code, reason: err instanceof Error ? err.message : String(err) });
      }
    }

    this.logger.log(
      `Import đối tác affiliate: ${inserted} mới, ${updated} cập nhật, ${skipped.length} bỏ qua`,
    );
    return { inserted, updated, skipped };
  }
}
