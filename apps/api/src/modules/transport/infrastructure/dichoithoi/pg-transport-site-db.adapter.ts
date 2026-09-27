import { Injectable } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import { DichoithoiSiteDbConnection } from "../../../shared/dichoithoi-site-db/dichoithoi-site-db.connection";
import type {
  PublishTransportInput,
  PublishTransportStopInput,
  TransportCardData,
  TransportSiteDb,
} from "../../application/ports/transport-site-db.port";

const ROLE_TO_NUM = { origin: 1, destination: 2, waypoint: 3 } as const;

const POI_KIND = 3;

/**
 * Adapter PostgreSQL cho v2.transport/v2.transport_stop (transport-plan §2) — dung chung
 * ket noi DichoithoiSiteDbConnection voi cac adapter site DB khac.
 */
@Injectable()
export class PgTransportSiteDbAdapter implements TransportSiteDb {
  constructor(private readonly db: DichoithoiSiteDbConnection) {}

  isConfigured(): boolean {
    return this.db.isConfigured();
  }

  async upsertTransport(input: PublishTransportInput): Promise<{ siteId: number }> {
    const params = {
      mode: input.mode,
      operatorName: input.operatorName,
      phone: input.phone,
      vehicleType: input.vehicleType,
      priceFrom: input.priceFrom,
      thumbnailUrl: input.thumbnailUrl,
      provider: input.provider,
      sourceUrl: input.sourceUrl,
      affiliateUrl: input.affiliateUrl,
      linkStatus: input.linkStatus,
    };
    const { rows } =
      input.siteId === null
        ? await this.db.query<{ id: number }>(
            `INSERT INTO v2.transport
               (mode, operator_name, phone, vehicle_type, price_from, thumbnail_url,
                provider, source_url, affiliate_url, link_status)
             VALUES
               (@mode, @operatorName, @phone, @vehicleType, @priceFrom, @thumbnailUrl,
                @provider, @sourceUrl, @affiliateUrl, @linkStatus)
             RETURNING id`,
            params,
          )
        : await this.db.query<{ id: number }>(
            `UPDATE v2.transport SET
               mode = @mode, operator_name = @operatorName, phone = @phone,
               vehicle_type = @vehicleType, price_from = @priceFrom, thumbnail_url = @thumbnailUrl,
               provider = @provider, source_url = @sourceUrl, affiliate_url = @affiliateUrl,
               link_status = @linkStatus, updated_at = now()
             WHERE id = @siteId RETURNING id`,
            { ...params, siteId: input.siteId },
          );
    const siteId = rows[0]?.id;
    if (!siteId) throw new UpstreamApiError(`Không upsert được nhà xe "${input.operatorName}"`);
    return { siteId };
  }

  async replaceStops(transportSiteId: number, stops: PublishTransportStopInput[]): Promise<void> {
    await this.db.transaction(async (query) => {
      await query(`DELETE FROM v2.transport_stop WHERE transport_id = @transportId`, {
        transportId: transportSiteId,
      });
      for (const stop of stops) {
        const { rowCount } = await query(
          `INSERT INTO v2.transport_stop (transport_id, destination_id, role, seq_order)
           SELECT @transportId::int, d.id, @role::smallint, @seqOrder::smallint
           FROM v2.destination d WHERE d.slug = @slug`,
          {
            transportId: transportSiteId,
            slug: stop.destinationSlug,
            role: ROLE_TO_NUM[stop.role],
            seqOrder: stop.seqOrder,
          },
        );
        if (rowCount === 0) {
          throw new UpstreamApiError(
            `Không tìm thấy điểm đến "${stop.destinationSlug}" cho điểm dừng tuyến xe`,
          );
        }
      }
    });
  }

  /**
   * Neu diem la POI (kind=3) tu dong resolve sang parent_id (cum cha) truoc
   * khi tra stop — POI khong bao gio la 1 dong transport_stop, chi ke thua
   * tu cum chua no (transport-plan §2). Chi lay role origin(1)/destination(2),
   * KHONG hien waypoint(3).
   */
  async findCardsForDestination(destinationSiteId: number, mode: number): Promise<TransportCardData[]> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT DISTINCT t.id, t.mode, t.operator_name, t.phone, t.vehicle_type, t.price_from,
         t.thumbnail_url, t.affiliate_url, t.source_url, t.link_status
       FROM v2.transport_stop s
       JOIN v2.transport t ON t.id = s.transport_id
       WHERE s.destination_id = (
           SELECT CASE WHEN d.kind = @poiKind THEN d.parent_id ELSE d.id END
           FROM v2.destination d WHERE d.id = @destinationId
         )
         AND s.role IN (1, 2) AND t.mode = @mode AND t.status = 1
       -- Giu thu tu cu cua SQL Server (NULL dung dau khi sap tang dan)
       ORDER BY t.price_from NULLS FIRST`,
      { destinationId: destinationSiteId, mode, poiKind: POI_KIND },
    );
    return rows.map((r) => ({
      id: r.id as number,
      mode: r.mode as number,
      operatorName: r.operator_name as string,
      phone: (r.phone as string | null) ?? null,
      vehicleType: (r.vehicle_type as string | null) ?? null,
      priceFrom: r.price_from === null ? null : Number(r.price_from),
      thumbnailUrl: (r.thumbnail_url as string | null) ?? null,
      affiliateUrl: (r.affiliate_url as string | null) ?? null,
      sourceUrl: (r.source_url as string | null) ?? null,
      linkStatus: r.link_status as string,
    }));
  }

  async findPoiChildSlugs(clusterSiteId: number): Promise<string[]> {
    const { rows } = await this.db.query<{ slug: string }>(
      `SELECT slug FROM v2.destination WHERE parent_id = @clusterId AND kind = @poiKind`,
      { clusterId: clusterSiteId, poiKind: POI_KIND },
    );
    return rows.map((r) => r.slug);
  }

  async deleteTransport(transportSiteId: number): Promise<void> {
    await this.db.transaction(async (query) => {
      await query(`DELETE FROM v2.transport_stop WHERE transport_id = @transportId`, {
        transportId: transportSiteId,
      });
      await query(`DELETE FROM v2.transport WHERE id = @transportId`, { transportId: transportSiteId });
    });
  }
}
