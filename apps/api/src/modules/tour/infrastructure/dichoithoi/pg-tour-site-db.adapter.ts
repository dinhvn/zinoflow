import { Injectable } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import { DichoithoiSiteDbConnection } from "../../../shared/dichoithoi-site-db/dichoithoi-site-db.connection";
import type {
  PublishTourInput,
  TourCardData,
  TourSiteDb,
} from "../../application/ports/tour-site-db.port";

const TOUR_COLUMNS_SQL = `
  name = @name, short_description = @shortDescription, duration_days = @durationDays,
  duration_nights = @durationNights, departure_from = @departureFrom,
  province_id = (SELECT id FROM v2.province WHERE code = @provinceCode),
  price_from = @priceFrom, rating = @rating, review_count = @reviewCount,
  thumbnail_url = @thumbnailUrl, images_json = @imagesJson, provider = @provider,
  source_url = @sourceUrl, affiliate_url = @affiliateUrl, link_status = @linkStatus`;

/** Adapter PostgreSQL cho v2.tour/v2.tour_destination_map (tour-spec §4). */
@Injectable()
export class PgTourSiteDbAdapter implements TourSiteDb {
  constructor(private readonly db: DichoithoiSiteDbConnection) {}

  isConfigured(): boolean {
    return this.db.isConfigured();
  }

  async upsertTour(input: PublishTourInput): Promise<{ siteId: number }> {
    const params = {
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
      imagesJson: input.imagesJson,
      provider: input.provider,
      sourceUrl: input.sourceUrl,
      affiliateUrl: input.affiliateUrl,
      linkStatus: input.linkStatus,
    };
    const { rows } =
      input.siteId === null
        ? await this.db.query<{ id: number }>(
            `INSERT INTO v2.tour
               (name, short_description, duration_days, duration_nights, departure_from, province_id,
                price_from, rating, review_count, thumbnail_url, images_json, provider, source_url,
                affiliate_url, link_status)
             VALUES
               (@name, @shortDescription, @durationDays, @durationNights, @departureFrom,
                (SELECT id FROM v2.province WHERE code = @provinceCode),
                @priceFrom, @rating, @reviewCount, @thumbnailUrl, @imagesJson, @provider, @sourceUrl,
                @affiliateUrl, @linkStatus)
             RETURNING id`,
            params,
          )
        : await this.db.query<{ id: number }>(
            `UPDATE v2.tour SET ${TOUR_COLUMNS_SQL}, updated_at = now()
             WHERE id = @siteId RETURNING id`,
            { ...params, siteId: input.siteId },
          );
    const siteId = rows[0]?.id;
    if (!siteId) throw new UpstreamApiError(`Không upsert được tour "${input.name}"`);
    return { siteId };
  }

  async assignToDestination(
    tourSiteId: number,
    destinationSlug: string,
    isPrimary: boolean,
    isManual: boolean,
  ): Promise<void> {
    const { rowCount } = await this.db.query(
      `INSERT INTO v2.tour_destination_map (tour_id, destination_id, is_primary, is_manual)
       SELECT @tourId::int, d.id, @isPrimary::boolean, @isManual::boolean
       FROM v2.destination d WHERE d.slug = @destinationSlug
       ON CONFLICT (tour_id, destination_id)
         DO UPDATE SET is_primary = EXCLUDED.is_primary, is_manual = EXCLUDED.is_manual`,
      { tourId: tourSiteId, destinationSlug, isPrimary, isManual },
    );
    if (rowCount === 0) {
      throw new UpstreamApiError(`Không tìm thấy điểm đến "${destinationSlug}" trên website để gắn tour`);
    }
  }

  async unassignFromDestination(tourSiteId: number, destinationSlug: string): Promise<void> {
    await this.db.query(
      `DELETE FROM v2.tour_destination_map m
       USING v2.destination d
       WHERE d.id = m.destination_id AND m.tour_id = @tourId AND d.slug = @destinationSlug`,
      { tourId: tourSiteId, destinationSlug },
    );
  }

  async findCardsForDestination(destinationSlug: string, take: number): Promise<TourCardData[]> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT t.id, t.name, t.short_description, t.duration_days, t.duration_nights,
         t.price_from, t.rating, t.review_count, t.thumbnail_url, t.affiliate_url, t.source_url, t.link_status
       FROM v2.tour_destination_map m
       JOIN v2.tour t ON t.id = m.tour_id
       JOIN v2.destination d ON d.id = m.destination_id
       WHERE d.slug = @destinationSlug AND t.status = 1
       ORDER BY t.rating DESC NULLS LAST
       LIMIT @take`,
      { destinationSlug, take },
    );
    return rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      shortDescription: (r.short_description as string | null) ?? null,
      durationDays: (r.duration_days as number | null) ?? null,
      durationNights: (r.duration_nights as number | null) ?? null,
      priceFrom: r.price_from === null ? null : Number(r.price_from),
      rating: r.rating === null ? null : Number(r.rating),
      reviewCount: (r.review_count as number | null) ?? null,
      thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
      affiliateUrl: (r.affiliate_url as string | null) ?? null,
      sourceUrl: r.source_url as string,
      linkStatus: r.link_status as string,
    }));
  }

  async findDestinationSlugsForTour(tourSiteId: number): Promise<string[]> {
    const { rows } = await this.db.query<{ slug: string }>(
      `SELECT d.slug FROM v2.tour_destination_map m
       JOIN v2.destination d ON d.id = m.destination_id
       WHERE m.tour_id = @tourId`,
      { tourId: tourSiteId },
    );
    return rows.map((r) => r.slug);
  }
}
