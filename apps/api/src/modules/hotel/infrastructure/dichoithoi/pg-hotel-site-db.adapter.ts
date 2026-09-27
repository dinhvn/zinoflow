import { Injectable } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import { DichoithoiSiteDbConnection } from "../../../shared/dichoithoi-site-db/dichoithoi-site-db.connection";
import type {
  HotelCardData,
  HotelSiteDb,
  PublishHotelInput,
} from "../../application/ports/hotel-site-db.port";

const HOTEL_COLUMNS_SQL = `
  name = @name, address = @address, lat = @lat, lng = @lng,
  province_id = (SELECT id FROM v2.province WHERE code = @provinceCode),
  price_from = @priceFrom, rating = @rating, review_count = @reviewCount,
  thumbnail_url = @thumbnailUrl, images_json = @imagesJson, provider = @provider,
  source_url = @sourceUrl, affiliate_url = @affiliateUrl, link_status = @linkStatus`;

/**
 * Adapter PostgreSQL cho v2.hotel/v2.hotel_destination_map (hotel-spec §4) — dung chung
 * ket noi DichoithoiSiteDbConnection voi cac adapter site DB khac.
 */
@Injectable()
export class PgHotelSiteDbAdapter implements HotelSiteDb {
  constructor(private readonly db: DichoithoiSiteDbConnection) {}

  isConfigured(): boolean {
    return this.db.isConfigured();
  }

  async upsertHotel(input: PublishHotelInput): Promise<{ siteId: number }> {
    const params = {
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
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
            `INSERT INTO v2.hotel
               (name, address, lat, lng, province_id, price_from, rating, review_count,
                thumbnail_url, images_json, provider, source_url, affiliate_url, link_status)
             VALUES
               (@name, @address, @lat, @lng, (SELECT id FROM v2.province WHERE code = @provinceCode),
                @priceFrom, @rating, @reviewCount, @thumbnailUrl, @imagesJson, @provider,
                @sourceUrl, @affiliateUrl, @linkStatus)
             RETURNING id`,
            params,
          )
        : await this.db.query<{ id: number }>(
            `UPDATE v2.hotel SET ${HOTEL_COLUMNS_SQL}, updated_at = now()
             WHERE id = @siteId RETURNING id`,
            { ...params, siteId: input.siteId },
          );
    const siteId = rows[0]?.id;
    if (!siteId) throw new UpstreamApiError(`Không upsert được khách sạn "${input.name}"`);
    return { siteId };
  }

  async assignToDestination(
    hotelSiteId: number,
    destinationSlug: string,
    distanceM: number | null,
    isManual: boolean,
  ): Promise<void> {
    const { rowCount } = await this.db.query(
      `INSERT INTO v2.hotel_destination_map (hotel_id, destination_id, distance_m, is_manual)
       SELECT @hotelId::int, d.id, @distanceM::int, @isManual::boolean
       FROM v2.destination d WHERE d.slug = @destinationSlug
       ON CONFLICT (hotel_id, destination_id)
         DO UPDATE SET distance_m = EXCLUDED.distance_m, is_manual = EXCLUDED.is_manual`,
      { hotelId: hotelSiteId, destinationSlug, distanceM, isManual },
    );
    if (rowCount === 0) {
      throw new UpstreamApiError(`Không tìm thấy điểm đến "${destinationSlug}" trên website để gắn khách sạn`);
    }
  }

  async unassignFromDestination(hotelSiteId: number, destinationSlug: string): Promise<void> {
    await this.db.query(
      `DELETE FROM v2.hotel_destination_map m
       USING v2.destination d
       WHERE d.id = m.destination_id AND m.hotel_id = @hotelId AND d.slug = @destinationSlug`,
      { hotelId: hotelSiteId, destinationSlug },
    );
  }

  async findCardsForDestination(destinationSlug: string, take: number): Promise<HotelCardData[]> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT h.id, h.name, h.address, h.price_from, h.rating, h.review_count,
         h.thumbnail_url, h.affiliate_url, h.source_url, h.link_status
       FROM v2.hotel_destination_map m
       JOIN v2.hotel h ON h.id = m.hotel_id
       JOIN v2.destination d ON d.id = m.destination_id
       WHERE d.slug = @destinationSlug AND h.status = 1
       ORDER BY h.rating DESC NULLS LAST
       LIMIT @take`,
      { destinationSlug, take },
    );
    return rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      address: (r.address as string | null) ?? null,
      priceFrom: r.price_from === null ? null : Number(r.price_from),
      rating: r.rating === null ? null : Number(r.rating),
      reviewCount: (r.review_count as number | null) ?? null,
      thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
      affiliateUrl: (r.affiliate_url as string | null) ?? null,
      sourceUrl: r.source_url as string,
      linkStatus: r.link_status as string,
    }));
  }

  async findDestinationSlugsForHotel(hotelSiteId: number): Promise<string[]> {
    const { rows } = await this.db.query<{ slug: string }>(
      `SELECT d.slug FROM v2.hotel_destination_map m
       JOIN v2.destination d ON d.id = m.destination_id
       WHERE m.hotel_id = @hotelId`,
      { hotelId: hotelSiteId },
    );
    return rows.map((r) => r.slug);
  }
}
