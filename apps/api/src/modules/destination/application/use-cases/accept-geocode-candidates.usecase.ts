import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AcceptGeocodeCandidatesRequest, AcceptGeocodeCandidatesResponse } from "@zinoflow/contracts";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMetadataInput,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  PLACE_GEOCODING_PROVIDER,
  type PlaceGeocodingProvider,
} from "../ports/place-geocoding-provider.port";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";

/**
 * Chap nhan 1 candidate da tim tu batch (Giai doan 1b) — goi lai Place
 * Details LIVE bang placeId da chon (staging chi luu placeId, khong luu
 * snapshot noi dung — dung dieu khoan Google, xem contracts geocode.ts)
 * roi ghi vao destination that. KHONG dung ghi ca loat khi 1 dong loi —
 * loi tung dong duoc gom rieng, cac dong con lai van xu ly tiep.
 */
@Injectable()
export class AcceptGeocodeCandidatesUseCase {
  private readonly logger = new Logger(AcceptGeocodeCandidatesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(PLACE_GEOCODING_PROVIDER)
    private readonly geocoder: PlaceGeocodingProvider,
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: DestinationGeocodeCandidateRepository,
  ) {}

  async execute(
    request: AcceptGeocodeCandidatesRequest,
  ): Promise<AcceptGeocodeCandidatesResponse> {
    const result: AcceptGeocodeCandidatesResponse = { updated: 0, errors: [] };

    for (const sel of request.selections) {
      try {
        const existing = await this.mirrorRepo.findBySlug(sel.destinationSlug);
        if (!existing) {
          throw new Error(`Không tìm thấy điểm đến "${sel.destinationSlug}"`);
        }

        const fresh = await this.geocoder.getDetails(sel.placeId);
        if (!fresh) {
          throw new Error("Google không còn tìm thấy địa điểm này (có thể đã bị xoá/gộp) — thử tìm lại");
        }

        const meta: DestinationMetadataInput = {
          name: existing.name,
          kind: existing.kind,
          parentSlug: existing.parentSlug,
          provinceCode: existing.provinceCode,
          shortDescription: existing.shortDescription,
          thumbnail: existing.thumbnail,
          googleMapsUrl:
            fresh.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${fresh.placeId}`,
          lat: fresh.lat,
          lng: fresh.lng,
          addressNew: fresh.formattedAddress ?? existing.addressNew,
          addressOld: existing.addressOld,
          contactPhone: fresh.nationalPhoneNumber ?? existing.contactPhone,
          contactWebsite: fresh.websiteUri ?? existing.contactWebsite,
          hotelGroupId: existing.hotelGroupId,
          priority: existing.priority,
          contentTier: existing.contentTier,
        };
        await this.mirrorRepo.updateMetadata(sel.destinationSlug, meta);

        if (existing.siteId !== null) {
          await this.siteDb.updateMetadata(existing.siteId, {
            slug: sel.destinationSlug,
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
            priority: meta.priority,
            contentTier: meta.contentTier,
          });
        }

        await this.candidateRepo.setStatus(sel.destinationSlug, "accepted");
        result.updated += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Chấp nhận geocode lỗi cho "${sel.destinationSlug}": ${message}`);
        result.errors.push({ destinationSlug: sel.destinationSlug, message });
      }
    }

    return result;
  }
}
