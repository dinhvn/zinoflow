import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Tour, UpsertTourRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  TOUR_REPOSITORY,
  type TourRecord,
  type TourRepository,
  type UpsertTourInput,
} from "../ports/tour.repository";
import { TOUR_SITE_DB, type TourSiteDb } from "../ports/tour-site-db.port";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { IngestExternalImageUseCase } from "../../../shared/media/application/ingest-external-image.usecase";
import { tourToDto } from "./list-tours.usecase";
import { RecomputeTourCardsUseCase } from "./recompute-tour-cards.usecase";

const TOUR_FTP_BASE_DIR_ENV = "DICHOITHOI_FTP_TOUR_BASE_DIR";

/**
 * Tao moi / sua tour — publish THANG xuong SQL Server ngay (tour-spec §2/§4:
 * khong AI, khong quality gate, khong review 2 chot).
 *
 * Anh (thumbnailUrl/images) — neu la URL ngoai thi ingest ve hosting minh
 * truoc khi luu (destination-spec §14.5, backlog §B Phase C muc 3), giong
 * het co che dung cho Hotel. Ingest loi -> giu URL ngoai tam thoi, khong chan luu.
 */
@Injectable()
export class UpsertTourUseCase {
  private readonly logger = new Logger(UpsertTourUseCase.name);

  constructor(
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    @Inject(TOUR_SITE_DB) private readonly siteDb: TourSiteDb,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly recomputeCards: RecomputeTourCardsUseCase,
    private readonly ingestImage: IngestExternalImageUseCase,
  ) {}

  async create(request: UpsertTourRequest): Promise<Tour> {
    const input = await this.toInput(request, null);
    const created = await this.tours.create(input);
    const withImages = await this.ingestImagesIfNeeded(created.id, input);
    if (withImages) await this.tours.update(created.id, withImages);
    await this.publish(created.id, null, withImages ?? input);
    const withSite = await this.tours.findById(created.id);
    if (!withSite) throw new DomainRuleError("Tour biến mất ngay sau khi tạo");
    return tourToDto(withSite, 0);
  }

  async update(id: string, request: UpsertTourRequest): Promise<Tour> {
    const existing = await this.tours.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy tour id=${id}`);
    const input = await this.toInput(request, existing);
    const withImages = (await this.ingestImagesIfNeeded(id, input)) ?? input;
    await this.tours.update(id, withImages);
    await this.publish(id, existing.siteId, withImages);
    const updated = await this.tours.findById(id);
    if (!updated) throw new DomainRuleError("Tour biến mất ngay sau khi cập nhật");
    // Gia/rating doi -> mọi diem den dang gan tour nay can tinh lai TourCardsJson
    if (updated.siteId !== null) {
      await this.recomputeCards.forTour(updated.siteId);
    }
    const counts = await this.tours.countDestinationsByTour();
    return tourToDto(updated, counts.get(id) ?? 0);
  }

  /**
   * existing = null khi tao moi. Khi sua, giu nguyen thumbnailSourceUrl/
   * imageSourceUrls cua ban ghi cu neu URL anh khong doi — tranh bug ghi de
   * mat provenance moi lan sua 1 truong khong lien quan anh (vd doi gia).
   */
  private async toInput(
    request: UpsertTourRequest,
    existing: TourRecord | null,
  ): Promise<UpsertTourInput> {
    const resolved = await this.resolveLink.execute(request.sourceUrl, request.provider ?? null);
    const thumbnailUrl = request.thumbnailUrl?.trim() || null;
    const images = request.images ?? [];
    return {
      name: request.name.trim(),
      shortDescription: request.shortDescription?.trim() || null,
      durationDays: request.durationDays ?? null,
      durationNights: request.durationNights ?? null,
      departureFrom: request.departureFrom?.trim() || null,
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

  private async ingestImagesIfNeeded(
    tourId: string,
    input: UpsertTourInput,
  ): Promise<UpsertTourInput | null> {
    let changed = false;
    let thumbnailUrl = input.thumbnailUrl;
    let thumbnailSourceUrl = input.thumbnailSourceUrl;
    if (isExternalUrl(input.thumbnailUrl)) {
      changed = true;
      thumbnailSourceUrl = input.thumbnailUrl;
      try {
        const paths = await this.ingestImage.execute(
          input.thumbnailUrl!,
          `${tourId}/${tourId}-thumbnail`,
          TOUR_FTP_BASE_DIR_ENV,
        );
        thumbnailUrl = paths.thumb;
      } catch (err) {
        this.logger.warn(
          `Ingest ảnh đại diện tour ${tourId} thất bại, giữ tạm URL ngoài: ` +
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
          `${tourId}/${tourId}-anh-${i + 1}`,
          TOUR_FTP_BASE_DIR_ENV,
        );
        images.push(paths.medium);
      } catch (err) {
        this.logger.warn(
          `Ingest ảnh phụ #${i + 1} tour ${tourId} thất bại, giữ tạm URL ngoài: ` +
            (err instanceof Error ? err.message : String(err)),
        );
        images.push(url);
      }
    }

    if (!changed) return null;
    return { ...input, thumbnailUrl, thumbnailSourceUrl, images, imageSourceUrls };
  }

  private async publish(id: string, siteId: number | null, input: UpsertTourInput): Promise<void> {
    const { siteId: newSiteId } = await this.siteDb.upsertTour({
      siteId,
      name: input.name,
      shortDescription: input.shortDescription,
      durationDays: input.durationDays,
      durationNights: input.durationNights,
      departureFrom: input.departureFrom,
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
      await this.tours.setSiteId(id, newSiteId);
      this.logger.log(`Publish tour mới "${input.name}" -> siteId ${newSiteId}`);
    }
  }
}

/** URL ngoai can ingest — path noi bo (da qua ingest) khong co scheme http(s) */
function isExternalUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
