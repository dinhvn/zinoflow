import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AcceptGeocodeCandidatesRequest, AcceptGeocodeCandidatesResponse } from "@zinoflow/contracts";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";
import { truncateLabel } from "../../../shared/text/truncate-label";
import { haversineMeters } from "../../domain/related-builder";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMetadataInput,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";

/**
 * Nguong coi 2 toa do la "trung nhau" — Google Maps redirect ve 1 dia danh
 * hanh chinh chung (locality) khi khong nhan dien duoc ten POI rieng khien
 * nhieu POI KHAC TEN trong cung 1 cum bi gan CHINH XAC 1 toa do (phat hien
 * qua audit du lieu that 14/08/2026: 44 nhom/95 POI dinh loi nay, vd cum
 * "a-pa-chai" — "Cot moc 0 A Pa Chai"/"Loi mo bien gioi..."/"Thap Muong Luan"
 * deu ra dung placeId cua trang "A Pa Chai, Sin Thau, Dien Bien"). 15m du
 * chat de khong bao gio khop nham 2 dia diem THAT gan nhau (sai so GPS dan
 * dung thuong <5m), nhung du long de bat ca truong hop lam tron toa do khac
 * nhau vai chu so cuoi.
 */
const DUPLICATE_COORDS_THRESHOLD_METERS = 15;

/**
 * Chap nhan 1 candidate da tim tu batch (Giai doan 1b) — ghi thang du lieu DA
 * QUET SAN trong bang staging vao destination that, KHONG goi lai Google
 * (quyet dinh 06/08/2026: PlaywrightGoogleMapsProvider khong bi rang buoc
 * dieu khoan cache cua Places API nhu provider cu, nen goi lai luc accept chi
 * ton them thoi gian/rui ro bi chan ma khong doi lay gi — xem contracts
 * geocode.ts). Link "Ket qua tren web" quet duoc duoc GOP (khong ghi de) vao
 * aiReferenceUrls co san, dedupe theo url. KHONG dung ghi ca loat khi 1 dong
 * loi — loi tung dong duoc gom rieng, cac dong con lai van xu ly tiep.
 */
@Injectable()
export class AcceptGeocodeCandidatesUseCase {
  private readonly logger = new Logger(AcceptGeocodeCandidatesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
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

        const staged = await this.candidateRepo.findBySlug(sel.destinationSlug);
        const fresh = staged?.candidates.find((c) => c.placeId === sel.placeId);
        if (!fresh) {
          throw new Error("Không tìm thấy ứng viên này trong kết quả đã quét — thử tìm lại");
        }

        if (fresh.latAtDiscovery != null && fresh.lngAtDiscovery != null && existing.parentSlug) {
          const collision = await this.findCoordinateCollision(
            existing.parentSlug,
            sel.destinationSlug,
            fresh.latAtDiscovery,
            fresh.lngAtDiscovery,
          );
          if (collision) {
            throw new Error(
              `Toạ độ ứng viên trùng với "${collision.name}" (${collision.slug}) đã có sẵn trong cùng cụm ` +
                `— Google có thể đã trả về địa danh chung thay vì đúng điểm này, xem lại tay trước khi chấp nhận`,
            );
          }
        }

        const meta: DestinationMetadataInput = {
          name: existing.name,
          kind: existing.kind,
          parentSlug: existing.parentSlug,
          provinceCode: existing.provinceCode,
          shortDescription: existing.shortDescription,
          thumbnail: existing.thumbnail,
          googleMapsUrl: fresh.googleMapsUrlAtDiscovery ?? fresh.placeId,
          lat: fresh.latAtDiscovery ?? (existing.lat === null ? null : Number(existing.lat)),
          lng: fresh.lngAtDiscovery ?? (existing.lng === null ? null : Number(existing.lng)),
          addressNew: fresh.formattedAddressAtDiscovery ?? existing.addressNew,
          addressOld: existing.addressOld,
          contactPhone: fresh.nationalPhoneNumberAtDiscovery ?? existing.contactPhone,
          contactWebsite: fresh.websiteUriAtDiscovery ?? existing.contactWebsite,
          hotelGroupId: existing.hotelGroupId,
          priority: existing.priority,
          contentTier: existing.contentTier,
        };
        await this.mirrorRepo.updateMetadata(sel.destinationSlug, meta);

        if (fresh.webResultUrlsAtDiscovery && fresh.webResultUrlsAtDiscovery.length > 0) {
          const existingUrls = new Set(existing.aiReferenceUrls.map((r) => r.url));
          const newUrls = fresh.webResultUrlsAtDiscovery
            .filter((r) => !existingUrls.has(r.url))
            // aiReferenceUrls.label gioi han <=100 ky tu (contracts destination.ts) — label
            // quet duoc tu Google (breadcrumb + tieu de + doan trich) co the dai toi 200
            .map((r) => ({ label: truncateLabel(r.label, 100), url: r.url }));
          if (newUrls.length > 0) {
            await this.mirrorRepo.saveAiInputs(sel.destinationSlug, existing.aiNotes, [
              ...existing.aiReferenceUrls,
              ...newUrls,
            ]);
          }
        }

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

  /**
   * Tim 1 POI KHAC (cung parentSlug, khac slug) da co lat/lng gan trong pham
   * vi DUPLICATE_COORDS_THRESHOLD_METERS — dau hieu Google tra ve dia danh
   * chung thay vi dung diem nay (xem ghi chu tren hang so). Chi so sanh trong
   * cung 1 cum (khac cum, gan nhau van hop le — vd thang canh giap ranh).
   */
  private async findCoordinateCollision(
    parentSlug: string,
    currentSlug: string,
    lat: number,
    lng: number,
  ): Promise<{ slug: string; name: string } | null> {
    const siblings = await this.mirrorRepo.listAllMatching({
      parentSlug,
      kind: "poi",
      sortBy: "name",
      sortDir: "asc",
    });
    for (const sibling of siblings) {
      if (sibling.slug === currentSlug || sibling.lat === null || sibling.lng === null) continue;
      const distanceMeters = haversineMeters(lat, lng, Number(sibling.lat), Number(sibling.lng));
      if (distanceMeters <= DUPLICATE_COORDS_THRESHOLD_METERS) {
        return { slug: sibling.slug, name: sibling.name };
      }
    }
    return null;
  }
}
