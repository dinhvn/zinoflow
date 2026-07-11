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
import { IngestExternalImageUseCase } from "../../../shared/media/application/ingest-external-image.usecase";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";
import { hotelToDto } from "./list-hotels.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";

const HOTEL_FTP_BASE_DIR_ENV = "DICHOITHOI_FTP_HOTEL_BASE_DIR";

/**
 * Tao moi / sua khach san — publish THANG xuong SQL Server ngay (hotel-spec §2/§4:
 * khong AI, khong quality gate, khong review 2 chot). affiliateUrl tinh qua
 * AffiliateLinkResolver luc luu (ghi dat, doc re).
 *
 * Anh (thumbnailUrl/images) — neu la URL ngoai (http/https, vd Booking.com/
 * Agoda/import Sheet) thi ingest ve hosting minh truoc khi luu (destination-
 * spec §14.5, backlog §B Phase C muc 3): KHONG hotlink. Anh loi thi GIU URL
 * ngoai tam thoi + log canh bao, KHONG chan luu ban ghi (never-block).
 */
@Injectable()
export class UpsertHotelUseCase {
  private readonly logger = new Logger(UpsertHotelUseCase.name);

  constructor(
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(HOTEL_SITE_DB) private readonly siteDb: HotelSiteDb,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly recomputeCards: RecomputeHotelCardsUseCase,
    private readonly ingestImage: IngestExternalImageUseCase,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async create(request: UpsertHotelRequest): Promise<Hotel> {
    const input = await this.toInput(request, null);
    const created = await this.hotels.create(input);
    // Anh can biet id de dat duong dan hosting -> ingest SAU khi da co id, roi ghi de.
    const withImages = await this.ingestImagesIfNeeded(created.id, input);
    if (withImages) await this.hotels.update(created.id, withImages);
    await this.publish(created.id, null, withImages ?? input);
    const withSite = await this.hotels.findById(created.id);
    if (!withSite) throw new DomainRuleError("Khách sạn biến mất ngay sau khi tạo");
    // Khach san moi co toa do -> enqueue gan tu dong theo khoang cach (hotel-spec §5 job 3)
    if (withSite.lat !== null && withSite.lng !== null) {
      await this.jobQueue.send(QUEUE_NAMES.hotelAutoAssign, {});
    }
    return hotelToDto(withSite, 0);
  }

  async update(id: string, request: UpsertHotelRequest): Promise<Hotel> {
    const existing = await this.hotels.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy khách sạn id=${id}`);
    const input = await this.toInput(request, existing);
    const withImages = (await this.ingestImagesIfNeeded(id, input)) ?? input;
    await this.hotels.update(id, withImages);
    await this.publish(id, existing.siteId, withImages);
    const updated = await this.hotels.findById(id);
    if (!updated) throw new DomainRuleError("Khách sạn biến mất ngay sau khi cập nhật");
    // Gia/rating doi -> mọi diem den dang gan hotel nay can tinh lai HotelCardsJson
    // (chieu nguoc — khac han recompute khi publish destination, Phase 15)
    if (updated.siteId !== null) {
      await this.recomputeCards.forHotel(updated.siteId);
    }
    const counts = await this.hotels.countDestinationsByHotel();
    return hotelToDto(updated, counts.get(id) ?? 0);
  }

  /**
   * existing = null khi tao moi (khong co gi de giu lai). Khi sua, giu nguyen
   * thumbnailSourceUrl/imageSourceUrls cua ban ghi cu neu URL anh khong doi —
   * tranh bug ghi de mat provenance moi lan sua 1 truong khong lien quan anh
   * (vd doi gia) trong khi ingestImagesIfNeeded chi dien lai khi co URL NGOAI moi.
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

  /**
   * Ingest thumbnailUrl/images la URL ngoai (http/https) ve hosting — tra ve
   * null neu khong co gi la URL ngoai (giu nguyen input, khong ghi de lan 2).
   */
  private async ingestImagesIfNeeded(
    hotelId: string,
    input: UpsertHotelInput,
  ): Promise<UpsertHotelInput | null> {
    let changed = false;
    let thumbnailUrl = input.thumbnailUrl;
    let thumbnailSourceUrl = input.thumbnailSourceUrl;
    if (isExternalUrl(input.thumbnailUrl)) {
      changed = true;
      thumbnailSourceUrl = input.thumbnailUrl;
      try {
        const paths = await this.ingestImage.execute(
          input.thumbnailUrl!,
          `${hotelId}/${hotelId}-thumbnail`,
          HOTEL_FTP_BASE_DIR_ENV,
        );
        thumbnailUrl = paths.thumb;
      } catch (err) {
        this.logger.warn(
          `Ingest ảnh đại diện khách sạn ${hotelId} thất bại, giữ tạm URL ngoài: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }

    const images: string[] = [];
    const imageSourceUrls: string[] = [];
    for (let i = 0; i < input.images.length; i += 1) {
      const url = input.images[i]!;
      if (!isExternalUrl(url)) {
        images.push(url);
        imageSourceUrls.push(input.imageSourceUrls[i] ?? "");
        continue;
      }
      changed = true;
      imageSourceUrls.push(url);
      try {
        const paths = await this.ingestImage.execute(
          url,
          `${hotelId}/${hotelId}-anh-${i + 1}`,
          HOTEL_FTP_BASE_DIR_ENV,
        );
        images.push(paths.medium);
      } catch (err) {
        this.logger.warn(
          `Ingest ảnh phụ #${i + 1} khách sạn ${hotelId} thất bại, giữ tạm URL ngoài: ` +
            (err instanceof Error ? err.message : String(err)),
        );
        images.push(url);
      }
    }

    if (!changed) return null;
    return { ...input, thumbnailUrl, thumbnailSourceUrl, images, imageSourceUrls };
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
