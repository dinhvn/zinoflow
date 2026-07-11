import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  HOTEL_REPOSITORY,
  type HotelRepository,
  type UpsertHotelInput,
} from "../ports/hotel.repository";
import { HOTEL_SITE_DB, type HotelSiteDb } from "../ports/hotel-site-db.port";
import { IngestExternalImageUseCase } from "../../../shared/media/application/ingest-external-image.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";

const HOTEL_FTP_BASE_DIR_ENV = "DICHOITHOI_FTP_HOTEL_BASE_DIR";

/**
 * Chay NEN (worker pg-boss `hotel.image-ingest`) — tach khoi UpsertHotelUseCase
 * (Phase 21.3, audit 07/2026: ingest anh truoc day chay DONG BO trong request
 * tao/sua khach san, lam cham API khi co nhieu anh). UpsertHotelUseCase gio
 * publish NGAY voi URL anh hien co (co the la URL ngoai), enqueue job nay ngay
 * sau — job tai ve/resize/FTP roi ghi de + publish lai. Ingest loi -> giu URL
 * ngoai tam thoi (never-block, dung nguyen tac cu).
 */
@Injectable()
export class IngestHotelImagesUseCase {
  private readonly logger = new Logger(IngestHotelImagesUseCase.name);

  constructor(
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(HOTEL_SITE_DB) private readonly siteDb: HotelSiteDb,
    private readonly ingestImage: IngestExternalImageUseCase,
    private readonly recomputeCards: RecomputeHotelCardsUseCase,
  ) {}

  async execute(hotelId: string): Promise<void> {
    const hotel = await this.hotels.findById(hotelId);
    if (!hotel) {
      this.logger.warn(`Ingest ảnh: không tìm thấy khách sạn id=${hotelId} (có thể đã bị xoá)`);
      return;
    }
    // affiliateUrl luon co gia tri that (resolver fallback ve sourceUrl neu chua
    // khop rule) — chi null-safe o day vi HotelRecord khai bao kieu nullable.
    const input: UpsertHotelInput = { ...hotel, affiliateUrl: hotel.affiliateUrl ?? hotel.sourceUrl };

    const withImages = await this.ingestImagesIfNeeded(hotelId, input);
    if (!withImages) return; // khong co URL ngoai nao can ingest

    await this.hotels.update(hotelId, withImages);
    await this.siteDb.upsertHotel({
      siteId: hotel.siteId,
      name: withImages.name,
      address: withImages.address,
      lat: withImages.lat,
      lng: withImages.lng,
      provinceCode: withImages.provinceCode,
      priceFrom: withImages.priceFrom,
      rating: withImages.rating,
      reviewCount: withImages.reviewCount,
      thumbnailUrl: withImages.thumbnailUrl,
      imagesJson: JSON.stringify(withImages.images),
      provider: withImages.provider,
      sourceUrl: withImages.sourceUrl,
      affiliateUrl: withImages.affiliateUrl,
      linkStatus: withImages.linkStatus,
    });
    if (hotel.siteId !== null) {
      await this.recomputeCards.forHotel(hotel.siteId);
    }
  }

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
}

/** URL ngoai can ingest — path noi bo (da qua ingest) khong co scheme http(s) */
function isExternalUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
