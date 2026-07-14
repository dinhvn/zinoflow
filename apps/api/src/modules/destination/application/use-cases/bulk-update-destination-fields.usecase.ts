import { Inject, Injectable, Logger } from "@nestjs/common";
import type { BulkUpdateDestinationFieldsResult, DestinationBulkEditRow } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMetadataInput,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";
import { ParseMapsLinkUseCase } from "./parse-maps-link.usecase";

/**
 * Sua nhanh nhieu diem den cung luc (export CSV -> sua tay tren Google Sheet ->
 * nhap lai) — CHI 7 field lien he/tham khao (DESTINATION_BULK_EDIT_FIELD_KEYS),
 * khop theo slug DA TON TAI (khong tao moi, khac ImportDestinationsUseCase).
 * O CSV RONG = khong doi field do (giu nguyen gia tri cu) — o CO GIA TRI luon
 * GHI DE, ke ca khac voi gia tri dang co (quyet dinh cua chu site).
 */
@Injectable()
export class BulkUpdateDestinationFieldsUseCase {
  private readonly logger = new Logger(BulkUpdateDestinationFieldsUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    private readonly parseMapsLink: ParseMapsLinkUseCase,
  ) {}

  async execute(rows: readonly DestinationBulkEditRow[]): Promise<BulkUpdateDestinationFieldsResult> {
    const result: BulkUpdateDestinationFieldsResult = { updated: 0, errors: [] };

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      try {
        const existing = await this.mirrorRepo.findBySlug(row.slug);
        if (!existing) {
          throw new Error(`Không tìm thấy điểm đến "${row.slug}" — chỉ sửa được điểm đã có`);
        }

        const providedGoogleMapsUrl = nonEmpty(row.googleMapsUrl);
        const googleMapsUrl = providedGoogleMapsUrl ?? existing.googleMapsUrl;
        const googleMapsUrlChanged =
          providedGoogleMapsUrl !== undefined && providedGoogleMapsUrl !== existing.googleMapsUrl;
        const coords =
          googleMapsUrlChanged && googleMapsUrl
            ? await this.parseMapsLink.execute(googleMapsUrl)
            : {
                lat: existing.lat === null ? null : Number(existing.lat),
                lng: existing.lng === null ? null : Number(existing.lng),
              };

        const meta: DestinationMetadataInput = {
          name: existing.name,
          kind: existing.kind,
          parentSlug: existing.parentSlug,
          provinceCode: existing.provinceCode,
          shortDescription: nonEmpty(row.shortDescription) ?? existing.shortDescription,
          thumbnail: existing.thumbnail,
          googleMapsUrl,
          lat: coords.lat,
          lng: coords.lng,
          addressNew: nonEmpty(row.addressNew) ?? existing.addressNew,
          addressOld: nonEmpty(row.addressOld) ?? existing.addressOld,
          contactPhone: nonEmpty(row.contactPhone) ?? existing.contactPhone,
          contactWebsite: nonEmpty(row.contactWebsite) ?? existing.contactWebsite,
          hotelGroupId: nonEmpty(row.hotelGroupId) ?? existing.hotelGroupId,
          isFeatured: existing.isFeatured,
          contentTier: existing.contentTier,
        };

        await this.mirrorRepo.updateMetadata(row.slug, meta);

        if (existing.siteId !== null) {
          await this.siteDb.updateMetadata(existing.siteId, {
            slug: row.slug,
            kind: meta.kind as "province" | "cluster" | "poi",
            parentSlug: meta.parentSlug,
            provinceCode: meta.provinceCode,
            name: meta.name,
            nameUnaccented: normalizeVietnamese(meta.name),
            shortDescription: meta.shortDescription,
            thumbnail: meta.thumbnail,
            lat: meta.lat,
            lng: meta.lng,
            googleMapsUrl: meta.googleMapsUrl,
            addressNew: meta.addressNew,
            addressOld: meta.addressOld,
            contactPhone: meta.contactPhone,
            contactWebsite: meta.contactWebsite,
            hotelGroupId: meta.hotelGroupId,
            isFeatured: meta.isFeatured,
            contentTier: meta.contentTier,
          });
        }

        result.updated += 1;
      } catch (err) {
        result.errors.push({
          row: i + 1,
          slug: row.slug,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Sua hang loat diem den: cap nhat ${result.updated}, loi ${result.errors.length}`,
    );
    return result;
  }
}

/** "" / khoang trang = khong doi field nay — chi ghi de khi CSV thuc su co gia tri. */
function nonEmpty(s: string | undefined): string | null | undefined {
  if (s === undefined) return undefined;
  const trimmed = s.trim();
  return trimmed === "" ? undefined : trimmed;
}
