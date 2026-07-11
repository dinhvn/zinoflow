import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Hotel, UpsertHotelRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  HOTEL_REPOSITORY,
  type HotelRecord,
  type HotelRepository,
  type UpsertHotelInput,
} from "../ports/hotel.repository";
import { HOTEL_SITE_DB, type HotelSiteDb } from "../ports/hotel-site-db.port";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";
import { hotelToDto } from "./list-hotels.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";

/**
 * Tao moi / sua khach san — publish THANG xuong SQL Server ngay (hotel-spec §2/§4:
 * khong AI, khong quality gate, khong review 2 chot). affiliateUrl tinh qua
 * AffiliateLinkResolver luc luu (ghi dat, doc re).
 *
 * Anh (thumbnailUrl/images) — neu la URL ngoai (http/https, vd Booking.com/
 * Agoda/import Sheet) thi KHONG ingest dong bo o day nua (Phase 21.3, audit
 * 07/2026: ingest dong bo lam cham request neu nhieu anh) — publish NGAY voi
 * URL hien co (co the la URL ngoai, tam hotlink), enqueue job
 * `hotel.image-ingest` chay nen tai ve/resize/FTP roi ghi de + publish lai
 * (xem ingest-hotel-images.usecase.ts). Anh loi trong job -> giu URL ngoai
 * tam thoi + log canh bao, KHONG chan gi (never-block, giu nguyen nguyen tac cu).
 */
@Injectable()
export class UpsertHotelUseCase {
  private readonly logger = new Logger(UpsertHotelUseCase.name);

  constructor(
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(HOTEL_SITE_DB) private readonly siteDb: HotelSiteDb,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly recomputeCards: RecomputeHotelCardsUseCase,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async create(request: UpsertHotelRequest): Promise<Hotel> {
    const input = await this.toInput(request, null);
    const created = await this.hotels.create(input);
    await this.publish(created.id, null, input);
    const withSite = await this.hotels.findById(created.id);
    if (!withSite) throw new DomainRuleError("Khách sạn biến mất ngay sau khi tạo");
    // Khach san moi co toa do -> enqueue gan tu dong theo khoang cach (hotel-spec §5 job 3)
    if (withSite.lat !== null && withSite.lng !== null) {
      await this.jobQueue.send(QUEUE_NAMES.hotelAutoAssign, {});
    }
    await this.enqueueImageIngestIfNeeded(created.id, input);
    return hotelToDto(withSite, 0);
  }

  async update(id: string, request: UpsertHotelRequest): Promise<Hotel> {
    const existing = await this.hotels.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy khách sạn id=${id}`);
    const input = await this.toInput(request, existing);
    await this.hotels.update(id, input);
    await this.publish(id, existing.siteId, input);
    const updated = await this.hotels.findById(id);
    if (!updated) throw new DomainRuleError("Khách sạn biến mất ngay sau khi cập nhật");
    // Gia/rating doi -> mọi diem den dang gan hotel nay can tinh lai HotelCardsJson
    // (chieu nguoc — khac han recompute khi publish destination, Phase 15)
    if (updated.siteId !== null) {
      await this.recomputeCards.forHotel(updated.siteId);
    }
    await this.enqueueImageIngestIfNeeded(id, input);
    const counts = await this.hotels.countDestinationsByHotel();
    return hotelToDto(updated, counts.get(id) ?? 0);
  }

  private async enqueueImageIngestIfNeeded(id: string, input: UpsertHotelInput): Promise<void> {
    const hasExternalImage =
      isExternalUrl(input.thumbnailUrl) || input.images.some((url) => isExternalUrl(url));
    if (hasExternalImage) {
      await this.jobQueue.send(QUEUE_NAMES.hotelImageIngest, { hotelId: id });
    }
  }

  /**
   * existing = null khi tao moi (khong co gi de giu lai). Khi sua, giu nguyen
   * thumbnailSourceUrl/imageSourceUrls cua ban ghi cu neu URL anh khong doi —
   * tranh bug ghi de mat provenance moi lan sua 1 truong khong lien quan anh
   * (vd doi gia) trong khi job `hotel.image-ingest` chi dien lai khi co URL
   * NGOAI moi (xem ingest-hotel-images.usecase.ts).
   */
  private async toInput(
    request: UpsertHotelRequest,
    existing: HotelRecord | null,
  ): Promise<UpsertHotelInput> {
    const resolved = await this.resolveLink.execute(request.sourceUrl, request.provider ?? null);
    const thumbnailUrl = request.thumbnailUrl?.trim() || null;
    const images = request.images ?? [];
    return {
      name: request.name.trim(),
      address: request.address?.trim() || null,
      lat: request.lat ?? null,
      lng: request.lng ?? null,
      provinceCode: request.provinceCode ?? null,
      priceFrom: request.priceFrom ?? null,
      rating: request.rating ?? null,
      reviewCount: request.reviewCount ?? null,
      thumbnailUrl,
      thumbnailSourceUrl:
        existing && existing.thumbnailUrl === thumbnailUrl ? existing.thumbnailSourceUrl : null,
      images,
      imageSourceUrls: images.map((url) => {
        const idx = existing?.images.indexOf(url) ?? -1;
        return idx >= 0 ? (existing!.imageSourceUrls[idx] ?? "") : "";
      }),
      provider: resolved.provider,
      sourceUrl: request.sourceUrl.trim(),
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
    };
  }

  private async publish(
    id: string,
    siteId: number | null,
    input: UpsertHotelInput,
  ): Promise<void> {
    const { siteId: newSiteId } = await this.siteDb.upsertHotel({
      siteId,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      provinceCode: input.provinceCode,
      priceFrom: input.priceFrom,
      rating: input.rating,
      reviewCount: input.reviewCount,
      thumbnailUrl: input.thumbnailUrl,
      imagesJson: JSON.stringify(input.images),
      provider: input.provider,
      sourceUrl: input.sourceUrl,
      affiliateUrl: input.affiliateUrl,
      linkStatus: input.linkStatus,
    });
    if (siteId === null) {
      await this.hotels.setSiteId(id, newSiteId);
      this.logger.log(`Publish khách sạn mới "${input.name}" -> siteId ${newSiteId}`);
    }
  }
}

/** URL ngoai can ingest — path noi bo (da qua ingest) khong co scheme http(s) */
function isExternalUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
