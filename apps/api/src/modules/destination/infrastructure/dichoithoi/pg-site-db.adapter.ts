import { Injectable } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import {
  DichoithoiSiteDbConnection,
  type NamedParams,
  type SiteDbTransactionQuery,
} from "../../../shared/dichoithoi-site-db/dichoithoi-site-db.connection";
import type { SiteDestinationRow } from "../../domain/destination-mirror";
import type { RelatedItem } from "../../domain/related-builder";
import type {
  AutoLinkTargetRow,
  DestinationCardFilter,
  DestinationCardRow,
  DichoithoiSiteDb,
  PublishDestinationInput,
  SiteContentCoverageRow,
  SiteContentRow,
  SiteDestinationContent,
  SiteDestinationMeta,
  SiteTagAssignmentRow,
  SiteTagRow,
  SiteTypeAssignmentRow,
  SiteTypeRow,
  TaxonomyContentRows,
} from "../../application/ports/dichoithoi-site-db.port";

const TAXONOMY_TABLE_BY_TARGET: Record<"group" | "type" | "province", string> = {
  group: "v2.destination_type_group",
  type: "v2.destination_type",
  province: "v2.province",
};

const SORT_COLUMN: Record<DestinationCardFilter["sort"], string> = {
  featured: `d.priority ASC, d."order" ASC`,
  newest: "d.created_at DESC",
  order: `d."order" ASC`,
};

const KIND_BY_NUMBER: Record<number, SiteDestinationRow["kind"]> = {
  1: "province",
  2: "cluster",
  3: "poi",
};

const NUMBER_BY_KIND: Record<SiteDestinationMeta["kind"], number> = {
  province: 1,
  cluster: 2,
  poi: 3,
};

/** RelationType 3 = "mentioned" — quan he sinh tu auto-link trong noi dung. */
const MENTIONED_RELATION_TYPE = 3;

/**
 * Hash noi dung (SHA-256, hex HOA) — publishDestination va fetchAllDestinations PHAI dung
 * cung bieu thuc nay thi sync moi so sanh duoc voi mirror. Hash tren UTF-8 (khac ban SQL
 * Server cu hash UTF-16) — khong sao vi DB website duoc publish lai tu dau khi chuyen PG.
 */
const CONTENT_HASH_SQL = (column: string) =>
  `upper(encode(sha256(convert_to(${column}, 'UTF8')), 'hex'))`;

/**
 * Adapter PostgreSQL cua website dichoithoi (schema v2 — redesign doc §4, plan Postgres
 * Giai doan 3). Ten bang/cot snake_case theo EF Core Migrations ben repo dichoithoi.
 * CHI module nay biet SQL — application layer chi thay port DichoithoiSiteDb.
 */
@Injectable()
export class PgSiteDbAdapter implements DichoithoiSiteDb {
  constructor(private readonly db: DichoithoiSiteDbConnection) {}

  isConfigured(): boolean {
    return this.db.isConfigured();
  }

  async fetchAllDestinations(): Promise<SiteDestinationRow[]> {
    const rows = await this.select(`
      SELECT
        d.id, d.slug, d.kind, d.name, d.short_description, d.thumbnail,
        d.lat, d.lng, d.google_maps_url, d.address_new, d.address_old, d.contact_phone, d.contact_website,
        d.hotel_group_id, d.priority, d.content_tier, d."order", d.distance_from_center,
        d.status, d.content_source, d.updated_at,
        p.code AS province_code,
        par.slug AS parent_slug,
        c.ticket_price,
        ${CONTENT_HASH_SQL("c.content_html")} AS content_hash,
        (
          SELECT string_agg(t.slug, ',')
          FROM v2.destination_type_map m
          JOIN v2.destination_type t ON t.id = m.type_id
          WHERE m.destination_id = d.id
        ) AS types_csv,
        (
          SELECT string_agg(tg.slug, ',')
          FROM v2.destination_tag_map tm
          JOIN v2.destination_tag tg ON tg.id = tm.tag_id
          WHERE tm.destination_id = d.id
        ) AS tags_csv
      FROM v2.destination d
      LEFT JOIN v2.destination par ON par.id = d.parent_id
      LEFT JOIN v2.province p ON p.id = d.province_id
      LEFT JOIN v2.destination_content c ON c.destination_id = d.id
    `);
    return rows.map((r) => ({
      siteId: r.id as number,
      slug: r.slug as string,
      kind: KIND_BY_NUMBER[r.kind as number] ?? "poi",
      parentSlug: (r.parent_slug as string | null) ?? null,
      provinceCode: (r.province_code as string | null) ?? null,
      name: r.name as string,
      shortDescription: (r.short_description as string | null) ?? null,
      thumbnail: (r.thumbnail as string | null) ?? null,
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      googleMapsUrl: (r.google_maps_url as string | null) ?? null,
      addressNew: (r.address_new as string | null) ?? null,
      addressOld: (r.address_old as string | null) ?? null,
      contactPhone: (r.contact_phone as string | null) ?? null,
      contactWebsite: (r.contact_website as string | null) ?? null,
      hotelGroupId: (r.hotel_group_id as string | null) ?? null,
      priority: Number(r.priority),
      contentTier: (r.content_tier as "flagship" | "standard" | null) ?? null,
      order: Number(r.order ?? 0),
      distanceFromCenter: r.distance_from_center === null ? null : Number(r.distance_from_center),
      siteStatus: Number(r.status),
      contentSource: r.content_source === null ? null : Number(r.content_source),
      contentHash: (r.content_hash as string | null) ?? null,
      siteUpdatedAt: toDateOrNull(r.updated_at),
      ticketPrice: (r.ticket_price as string | null) ?? null,
      types: r.types_csv ? String(r.types_csv).split(",") : [],
      tags: r.tags_csv ? String(r.tags_csv).split(",") : [],
    }));
  }

  async fetchDestinationContent(siteId: number): Promise<SiteDestinationContent | null> {
    const rows = await this.select(
      `SELECT content_html, opening_time, ticket_price, transport, food, hotel_text, tip,
              price_breakdown_json, practical_notes_json, faq_json, content_updated_at, last_verified_at
       FROM v2.destination_content WHERE destination_id = @siteId`,
      { siteId },
    );
    const r = rows[0];
    if (!r) return null;
    return {
      contentHtml: (r.content_html as string) ?? "",
      openingTime: (r.opening_time as string | null) ?? null,
      ticketPrice: (r.ticket_price as string | null) ?? null,
      transport: (r.transport as string | null) ?? null,
      food: (r.food as string | null) ?? null,
      hotel: (r.hotel_text as string | null) ?? null,
      tip: (r.tip as string | null) ?? null,
      priceBreakdownJson: (r.price_breakdown_json as string | null) ?? null,
      practicalNotesJson: (r.practical_notes_json as string | null) ?? null,
      faqJson: (r.faq_json as string | null) ?? null,
      contentUpdatedAt: toDateOrNull(r.content_updated_at),
      lastVerifiedAt: toDateOrNull(r.last_verified_at),
    };
  }

  /** content-freshness-plan.md Giai doan D — xac nhan thu cong, khong dung publish */
  async markContentVerified(siteId: number): Promise<void> {
    await this.db.query(
      `UPDATE v2.destination_content SET last_verified_at = now() WHERE destination_id = @siteId`,
      { siteId },
    );
  }

  /** content-freshness-plan.md Giai doan C — bien tap vien xac nhan ket qua AI phan loai */
  async markContentUpdatedNow(siteId: number): Promise<void> {
    await this.db.query(
      `UPDATE v2.destination_content SET content_updated_at = now() WHERE destination_id = @siteId`,
      { siteId },
    );
  }

  async fetchProvinceSlugs(): Promise<Array<{ slug: string; code: string; name: string }>> {
    const rows = await this.select(`SELECT slug, code, name FROM v2.province ORDER BY name`);
    return rows.map((r) => ({ slug: r.slug as string, code: r.code as string, name: r.name as string }));
  }

  async fetchTypes(): Promise<SiteTypeRow[]> {
    const rows = await this.select(`SELECT id, slug, name FROM v2.destination_type ORDER BY "order", name`);
    return rows.map((r) => ({ id: Number(r.id), slug: r.slug as string, name: r.name as string }));
  }

  /**
   * Publish bai AI vao DB website trong 1 transaction. KHONG wipe: update dong destination
   * co san + upsert destination_content theo destination_id.
   */
  async publishDestination(input: PublishDestinationInput): Promise<{ contentHash: string }> {
    const targets = [...new Set(input.mentionedTargetSiteIds)].filter((id) => id !== input.siteId);

    const contentHash = await this.db.transaction(async (query) => {
      await query(
        `UPDATE v2.destination SET
           short_description = @shortDescription,
           search_keyword    = @searchKeyword,
           thumbnail         = @thumbnail,
           content_source    = 1,
           updated_at        = now()
         WHERE id = @siteId`,
        {
          siteId: input.siteId,
          shortDescription: input.shortDescription,
          searchKeyword: input.searchKeyword,
          thumbnail: input.thumbnail,
        },
      );

      // content_updated_at CHI bump khi contentChanged (content-freshness-plan.md
      // Giai doan B/C — noi dung THUC SU doi), khac updated_at o tren bi moi thao
      // tac publish dung vao du khong doi noi dung gi. Dong moi luon lay now().
      await query(
        `INSERT INTO v2.destination_content
           (destination_id, content_html, opening_time, ticket_price, transport, food, hotel_text,
            tip, faq_json, ticket_links_json, price_breakdown_json, practical_notes_json, gallery_json,
            title, meta_title, meta_description, content_updated_at)
         VALUES
           (@siteId, @contentHtml, @openingTime, @ticketPrice, @transport, @food, @hotel,
            @tip, @faqJson, @ticketLinksJson, @priceBreakdownJson, @practicalNotesJson,
            @galleryJson, @title, @metaTitle, @metaDescription, now())
         ON CONFLICT (destination_id) DO UPDATE SET
           content_html = EXCLUDED.content_html, opening_time = EXCLUDED.opening_time,
           ticket_price = EXCLUDED.ticket_price, transport = EXCLUDED.transport,
           food = EXCLUDED.food, hotel_text = EXCLUDED.hotel_text, tip = EXCLUDED.tip,
           faq_json = EXCLUDED.faq_json, ticket_links_json = EXCLUDED.ticket_links_json,
           price_breakdown_json = EXCLUDED.price_breakdown_json,
           practical_notes_json = EXCLUDED.practical_notes_json,
           gallery_json = EXCLUDED.gallery_json, title = EXCLUDED.title,
           meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
           content_updated_at = CASE WHEN @contentChanged::boolean THEN now()
                                     ELSE v2.destination_content.content_updated_at END`,
        {
          siteId: input.siteId,
          contentHtml: input.contentHtml,
          openingTime: input.openingTime,
          ticketPrice: input.ticketPrice,
          transport: input.transport,
          food: input.food,
          hotel: input.hotel,
          tip: input.tip,
          faqJson: input.faqJson,
          ticketLinksJson: input.ticketLinksJson,
          priceBreakdownJson: input.priceBreakdownJson,
          practicalNotesJson: input.practicalNotesJson,
          galleryJson: input.galleryJson,
          title: input.title,
          metaTitle: input.metaTitle,
          metaDescription: input.metaDescription,
          contentChanged: input.contentChanged,
        },
      );

      // Quan he mentioned tu auto-link: thay toan bo dong auto cu cua nguon nay
      await query(
        `DELETE FROM v2.destination_relation
         WHERE source_id = @siteId AND relation_type = @relationType AND is_auto`,
        { siteId: input.siteId, relationType: MENTIONED_RELATION_TYPE },
      );
      await this.insertMentionedRelations(query, input.siteId, targets);

      const { rows } = await query<{ content_hash: string }>(
        `SELECT ${CONTENT_HASH_SQL("content_html")} AS content_hash
         FROM v2.destination_content WHERE destination_id = @siteId`,
        { siteId: input.siteId },
      );
      return rows[0]?.content_hash;
    });

    if (!contentHash) {
      throw new UpstreamApiError(
        `Publish điểm đến siteId=${input.siteId} không ghi được nội dung (không thấy dòng DestinationContent sau khi ghi)`,
      );
    }
    return { contentHash };
  }

  async fetchAllContentRows(): Promise<SiteContentRow[]> {
    const rows = await this.select(`
      SELECT d.id, d.slug, c.content_html
      FROM v2.destination_content c
      JOIN v2.destination d ON d.id = c.destination_id
      WHERE d.status = 1
    `);
    return rows.map((r) => ({
      siteId: r.id as number,
      slug: r.slug as string,
      contentHtml: (r.content_html as string | null) ?? "",
    }));
  }

  async updateContentHtml(siteId: number, contentHtml: string): Promise<void> {
    await this.updateContentColumn(siteId, "content_html", contentHtml);
  }

  async addMentionedRelations(
    sourceSiteId: number,
    targetSiteIds: readonly number[],
  ): Promise<void> {
    const targets = [...new Set(targetSiteIds)].filter((id) => id !== sourceSiteId);
    if (targets.length === 0) return;
    await this.db.transaction((query) => this.insertMentionedRelations(query, sourceSiteId, targets));
  }

  async fetchSlugRedirects(): Promise<Map<string, string>> {
    const rows = await this.select(`
      SELECT r.old_slug, d.slug
      FROM v2.slug_redirect r
      JOIN v2.destination d ON d.id = r.destination_id
    `);
    return new Map(rows.map((r) => [r.old_slug as string, r.slug as string]));
  }

  async updateRelatedJson(siteId: number, relatedJson: string): Promise<boolean> {
    // Chi ghi khi gia tri doi — tranh write + invalidate cache vo ich (spec §12.3)
    return this.updateContentColumnIfChanged(siteId, "related_json", relatedJson);
  }

  async fetchRelatedJson(slug: string): Promise<RelatedItem[]> {
    const rows = await this.select(
      `SELECT c.related_json
       FROM v2.destination d
       JOIN v2.destination_content c ON c.destination_id = d.id
       WHERE d.slug = @slug`,
      { slug },
    );
    const raw = rows[0]?.related_json as string | null | undefined;
    if (!raw) return [];
    try {
      return JSON.parse(raw) as RelatedItem[];
    } catch {
      return [];
    }
  }

  async createDestination(meta: SiteDestinationMeta): Promise<{ siteId: number }> {
    const { rows } = await this.db.query<{ id: number }>(
      `INSERT INTO v2.destination
         (slug, kind, parent_id, province_id, name, name_unaccented, short_description, thumbnail,
          lat, lng, google_maps_url, address_new, address_old, contact_phone, contact_website,
          hotel_group_id, priority, content_tier, status, content_source)
       VALUES
         (@slug, @kind,
          (SELECT id FROM v2.destination WHERE slug = @parentSlug),
          (SELECT id FROM v2.province WHERE code = @provinceCode),
          @name, @nameUnaccented, COALESCE(@shortDescription, ''), @thumbnail, @lat, @lng,
          @googleMapsUrl, @addressNew, @addressOld, @contactPhone, @contactWebsite,
          @hotelGroupId, @priority, @contentTier, 1, 1)
       RETURNING id`,
      toMetaParams(meta),
    );
    const siteId = rows[0]?.id;
    if (!siteId) {
      throw new UpstreamApiError(`Không tạo được điểm đến "${meta.slug}" trên database website`);
    }
    return { siteId };
  }

  async updateMetadata(siteId: number, meta: SiteDestinationMeta): Promise<void> {
    await this.db.query(
      `UPDATE v2.destination SET
         kind = @kind,
         parent_id = (SELECT id FROM v2.destination WHERE slug = @parentSlug),
         province_id = (SELECT id FROM v2.province WHERE code = @provinceCode),
         name = @name, name_unaccented = @nameUnaccented,
         short_description = COALESCE(@shortDescription, ''), thumbnail = @thumbnail,
         lat = @lat, lng = @lng, google_maps_url = @googleMapsUrl,
         address_new = @addressNew, address_old = @addressOld,
         contact_phone = @contactPhone, contact_website = @contactWebsite,
         hotel_group_id = @hotelGroupId, priority = @priority, content_tier = @contentTier,
         updated_at = now()
       WHERE id = @siteId`,
      { ...toMetaParams(meta), siteId },
    );
  }

  async renameSlug(siteId: number, oldSlug: string, newSlug: string): Promise<void> {
    await this.db.transaction(async (query) => {
      const params = { siteId, oldSlug, newSlug };
      await query(`UPDATE v2.destination SET slug = @newSlug, updated_at = now() WHERE id = @siteId`, params);
      await query(
        `UPDATE v2.article_destination_map SET destination_slug = @newSlug WHERE destination_slug = @oldSlug`,
        params,
      );
      await query(
        `INSERT INTO v2.slug_redirect (old_slug, destination_id) VALUES (@oldSlug, @siteId)
         ON CONFLICT (old_slug) DO UPDATE SET destination_id = EXCLUDED.destination_id`,
        params,
      );
    });
  }

  async deleteDestination(siteId: number, slug: string): Promise<void> {
    await this.db.transaction(async (query) => {
      const params = { siteId, slug };
      await query(`DELETE FROM v2.destination_tag_map WHERE destination_id = @siteId`, params);
      await query(`DELETE FROM v2.destination_type_map WHERE destination_id = @siteId`, params);
      await query(`DELETE FROM v2.destination_content WHERE destination_id = @siteId`, params);
      await query(
        `DELETE FROM v2.destination_relation WHERE source_id = @siteId OR target_id = @siteId`,
        params,
      );
      await query(`DELETE FROM v2.article_destination_map WHERE destination_slug = @slug`, params);
      await query(`DELETE FROM v2.slug_redirect WHERE destination_id = @siteId`, params);
      await query(`DELETE FROM v2.destination WHERE id = @siteId`, params);
    });
  }

  /** article-spec §3.1 khoi `destinations` — CHI diem da published (status=1) */
  async findDestinationCards(filter: DestinationCardFilter): Promise<DestinationCardRow[]> {
    const conditions: string[] = ["d.status = 1"];
    const params: Record<string, unknown> = { limit: filter.limit };
    if (filter.typeSlug) {
      conditions.push(
        "EXISTS (SELECT 1 FROM v2.destination_type_map m JOIN v2.destination_type t ON t.id = m.type_id " +
          "WHERE m.destination_id = d.id AND t.slug = @typeSlug)",
      );
      params.typeSlug = filter.typeSlug;
    }
    if (filter.provinceSlug) {
      conditions.push("p.slug = @provinceSlug");
      params.provinceSlug = filter.provinceSlug;
    }
    if (filter.parentSlug) {
      conditions.push("par.slug = @parentSlug");
      params.parentSlug = filter.parentSlug;
    }
    const rows = await this.select(
      `SELECT d.slug, d.name, d.short_description, d.thumbnail, d.kind
       FROM v2.destination d
       LEFT JOIN v2.province p ON p.id = d.province_id
       LEFT JOIN v2.destination par ON par.id = d.parent_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${SORT_COLUMN[filter.sort]}
       LIMIT @limit`,
      params,
    );
    return rows.map(toDestinationCard);
  }

  async findDestinationCardBySlug(slug: string): Promise<DestinationCardRow | null> {
    const rows = await this.select(
      `SELECT slug, name, short_description, thumbnail, kind
       FROM v2.destination WHERE slug = @slug AND status = 1`,
      { slug },
    );
    return rows[0] ? toDestinationCard(rows[0]) : null;
  }

  /** Phase 18.2 — noi dung /loai, /tinh cho trang admin sua Description danh muc */
  async fetchTaxonomyContent(): Promise<TaxonomyContentRows> {
    const [groups, types, provinces] = await Promise.all([
      this.select(
        `SELECT id, slug, name, description, meta_description FROM v2.destination_type_group ORDER BY "order", name`,
      ),
      this.select(
        `SELECT id, group_id, slug, name, description, meta_description FROM v2.destination_type ORDER BY "order", name`,
      ),
      this.select(`SELECT id, slug, code, name, description, meta_description FROM v2.province ORDER BY name`),
    ]);
    return {
      groups: groups.map((r) => ({
        id: Number(r.id),
        slug: r.slug as string,
        name: r.name as string,
        description: (r.description as string | null) ?? null,
        metaDescription: (r.meta_description as string | null) ?? null,
      })),
      types: types.map((r) => ({
        id: Number(r.id),
        groupId: Number(r.group_id),
        slug: r.slug as string,
        name: r.name as string,
        description: (r.description as string | null) ?? null,
        metaDescription: (r.meta_description as string | null) ?? null,
      })),
      provinces: provinces.map((r) => ({
        id: Number(r.id),
        slug: r.slug as string,
        code: r.code as string,
        name: r.name as string,
        description: (r.description as string | null) ?? null,
        metaDescription: (r.meta_description as string | null) ?? null,
      })),
    };
  }

  /** Phase 18.2 + auto-link Group/Province (07/2026) — sua doan gioi thieu 1 group/type/province
   * (content-seo-ux-plan §10.3). Luon ghi descriptionHtml (co the null khi Description rong). */
  async updateTaxonomyDescription(
    target: "group" | "type" | "province",
    id: number,
    description: string | null,
    metaDescription: string | null,
    descriptionHtml: string | null,
  ): Promise<void> {
    const table = TAXONOMY_TABLE_BY_TARGET[target];
    await this.db.query(
      `UPDATE ${table}
       SET description = @description, meta_description = @metaDescription, description_html = @descriptionHtml
       WHERE id = @id`,
      { id, description, metaDescription, descriptionHtml },
    );
  }

  /** Diem den (published) dang gan 1 Type — target cho auto-link mo ta Type. */
  async fetchDestinationsForType(typeId: number): Promise<AutoLinkTargetRow[]> {
    return this.selectAutoLinkTargets(
      `SELECT DISTINCT d.slug, d.name
       FROM v2.destination_type_map m
       JOIN v2.destination d ON d.id = m.destination_id
       WHERE m.type_id = @typeId AND d.status = 1`,
      { typeId },
    );
  }

  /** Diem den (published) thuoc bat ky Type nao trong 1 Group — target cho auto-link mo ta Group,
   * cung tap voi luoi hien thi tren /loai/{group} (GetGroupPageAsync ben website). */
  async fetchDestinationsForGroup(groupId: number): Promise<AutoLinkTargetRow[]> {
    return this.selectAutoLinkTargets(
      `SELECT DISTINCT d.slug, d.name
       FROM v2.destination_type_map m
       JOIN v2.destination_type t ON t.id = m.type_id
       JOIN v2.destination d ON d.id = m.destination_id
       WHERE t.group_id = @groupId AND d.status = 1`,
      { groupId },
    );
  }

  /** Diem den (published) la con TRUC TIEP cua node tinh — target cho auto-link mo ta Province,
   * cung dieu kien loc voi GetProvincePageAsync ben website (parent_id, KHONG phai province_id —
   * tranh trung noi dung voi cac cum con nhu Da Lat/Phan Thiet, xem database-redesign §3.4). */
  async fetchDestinationsForProvince(provinceId: number): Promise<AutoLinkTargetRow[]> {
    return this.selectAutoLinkTargets(
      `SELECT d.slug, d.name
       FROM v2.destination d
       JOIN v2.province p ON p.destination_id = d.parent_id
       WHERE p.id = @provinceId AND d.status = 1`,
      { provinceId },
    );
  }

  async updateAncestorsChildren(
    siteId: number,
    ancestorsJson: string,
    childrenJson: string,
  ): Promise<boolean> {
    // Chi ghi khi it nhat 1 cot doi gia tri — tranh write + invalidate cache vo ich
    const { rowCount } = await this.db.query(
      `UPDATE v2.destination_content SET ancestors_json = @ancestorsJson, children_json = @childrenJson
       WHERE destination_id = @siteId
         AND (ancestors_json IS DISTINCT FROM @ancestorsJson OR children_json IS DISTINCT FROM @childrenJson)`,
      { siteId, ancestorsJson, childrenJson },
    );
    return rowCount > 0;
  }

  async updateHotelCards(siteId: number, hotelCardsJson: string): Promise<boolean> {
    return this.updateContentColumnIfChanged(siteId, "hotel_cards_json", hotelCardsJson);
  }

  async updateTourCards(siteId: number, tourCardsJson: string): Promise<boolean> {
    return this.updateContentColumnIfChanged(siteId, "tour_cards_json", tourCardsJson);
  }

  async updateTransportCards(siteId: number, transportCardsJson: string): Promise<boolean> {
    return this.updateContentColumnIfChanged(siteId, "transport_cards_json", transportCardsJson);
  }

  async updateSouvenirProducts(siteId: number, souvenirProductsJson: string): Promise<boolean> {
    return this.updateContentColumnIfChanged(siteId, "souvenir_products_json", souvenirProductsJson);
  }

  async updateHeroImageMeta(siteId: number, heroImageMetaJson: string | null): Promise<void> {
    await this.updateContentColumn(siteId, "hero_image_meta_json", heroImageMetaJson);
  }

  async updateThumbnail(siteId: number, thumbnail: string | null): Promise<void> {
    await this.db.query(
      `UPDATE v2.destination SET thumbnail = @thumbnail, updated_at = now() WHERE id = @siteId`,
      { siteId, thumbnail },
    );
  }

  async updateDistanceFromCenter(siteId: number, distanceMeters: number): Promise<void> {
    await this.db.query(
      `UPDATE v2.destination SET distance_from_center = @distanceMeters, updated_at = now() WHERE id = @siteId`,
      { siteId, distanceMeters },
    );
  }

  async updateTicketLinks(siteId: number, ticketLinksJson: string): Promise<void> {
    await this.updateContentColumn(siteId, "ticket_links_json", ticketLinksJson);
  }

  async updatePriceBreakdown(siteId: number, priceBreakdownJson: string): Promise<void> {
    await this.updateContentColumn(siteId, "price_breakdown_json", priceBreakdownJson);
  }

  async updatePracticalNotes(siteId: number, practicalNotesJson: string): Promise<void> {
    await this.updateContentColumn(siteId, "practical_notes_json", practicalNotesJson);
  }

  async updateEditorialReview(siteId: number, editorialReview: string | null): Promise<void> {
    await this.updateContentColumn(siteId, "editorial_review", editorialReview);
  }

  /** Tao dong destination_content rong neu chua co — meta title dat duoc ca truoc khi co noi dung. */
  async updateMetaTitle(siteId: number, metaTitle: string | null): Promise<void> {
    await this.db.query(
      `INSERT INTO v2.destination_content (destination_id, content_html, meta_title)
       VALUES (@siteId, '', @metaTitle)
       ON CONFLICT (destination_id) DO UPDATE SET meta_title = EXCLUDED.meta_title`,
      { siteId, metaTitle },
    );
  }

  async updateExternalReviewUrls(siteId: number, externalReviewUrlsJson: string): Promise<void> {
    await this.updateContentColumn(siteId, "external_review_urls_json", externalReviewUrlsJson);
  }

  async updateGallery(siteId: number, galleryJson: string): Promise<void> {
    await this.updateContentColumn(siteId, "gallery_json", galleryJson);
  }

  /** destination-spec §2.4 buoc 0 — tag seed san qua migration SeedCatalog ben dichoithoi */
  async fetchTags(): Promise<SiteTagRow[]> {
    const rows = await this.select(
      `SELECT id, slug, name, description, meta_description, status FROM v2.destination_tag ORDER BY name`,
    );
    return rows.map((r) => ({
      id: Number(r.id),
      slug: r.slug as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      metaDescription: (r.meta_description as string | null) ?? null,
      status: Number(r.status),
    }));
  }

  /** Diem den (published) dang gan 1 Tag — target cho auto-link mo ta Tag. */
  async fetchDestinationsForTag(tagSlug: string): Promise<AutoLinkTargetRow[]> {
    return this.selectAutoLinkTargets(
      `SELECT DISTINCT d.slug, d.name
       FROM v2.destination_tag_map m
       JOIN v2.destination_tag t ON t.id = m.tag_id
       JOIN v2.destination d ON d.id = m.destination_id
       WHERE t.slug = @tagSlug AND d.status = 1`,
      { tagSlug },
    );
  }

  async fetchTagAssignments(): Promise<SiteTagAssignmentRow[]> {
    const rows = await this.select(`
      SELECT d.id, d.slug, d.name, t.slug AS tag_slug
      FROM v2.destination d
      LEFT JOIN v2.destination_tag_map m ON m.destination_id = d.id
      LEFT JOIN v2.destination_tag t ON t.id = m.tag_id
      WHERE d.status = 1
      ORDER BY d.name
    `);
    return groupSlugsByDestination(rows, "tag_slug").map((g) => ({ ...g.destination, tagSlugs: g.slugs }));
  }

  async replaceTagAssignments(destinationSlug: string, tagSlugs: readonly string[]): Promise<void> {
    await this.db.transaction(async (query) => {
      const destinationId = await this.findDestinationIdBySlug(query, destinationSlug);
      if (destinationId === null) return;
      await query(`DELETE FROM v2.destination_tag_map WHERE destination_id = @destinationId`, {
        destinationId,
      });
      await query(
        `INSERT INTO v2.destination_tag_map (destination_id, tag_id)
         SELECT @destinationId::int, id FROM v2.destination_tag WHERE slug = ANY(@tagSlugs::text[])`,
        { destinationId, tagSlugs: [...new Set(tagSlugs)] },
      );
    });
  }

  async updateTagDescription(
    tagSlug: string,
    description: string | null,
    metaDescription: string | null,
    descriptionHtml: string | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE v2.destination_tag
       SET description = @description, meta_description = @metaDescription, description_html = @descriptionHtml
       WHERE slug = @slug`,
      { slug: tagSlug, description, metaDescription, descriptionHtml },
    );
  }

  async createTag(input: { slug: string; name: string; description: string | null }): Promise<void> {
    await this.db.query(
      `INSERT INTO v2.destination_tag (slug, name, description, status) VALUES (@slug, @name, @description, 1)`,
      { slug: input.slug, name: input.name, description: input.description },
    );
  }

  async updateTag(tagSlug: string, fields: { name?: string; status?: number }): Promise<void> {
    const sets: string[] = [];
    const params: Record<string, unknown> = { slug: tagSlug };
    if (fields.name !== undefined) {
      sets.push("name = @name");
      params.name = fields.name;
    }
    if (fields.status !== undefined) {
      sets.push("status = @status");
      params.status = fields.status;
    }
    if (sets.length === 0) return;
    await this.db.query(`UPDATE v2.destination_tag SET ${sets.join(", ")} WHERE slug = @slug`, params);
  }

  async countTagUsage(tagSlug: string): Promise<number> {
    const rows = await this.select(
      `SELECT COUNT(*) AS used_count
       FROM v2.destination_tag_map m
       JOIN v2.destination_tag t ON t.id = m.tag_id
       WHERE t.slug = @slug`,
      { slug: tagSlug },
    );
    // COUNT(*) la bigint — pg tra ve chuoi
    return Number(rows[0]?.used_count ?? 0);
  }

  async deleteTag(tagSlug: string): Promise<void> {
    await this.db.query(`DELETE FROM v2.destination_tag WHERE slug = @slug`, { slug: tagSlug });
  }

  async fetchTypeAssignments(): Promise<SiteTypeAssignmentRow[]> {
    const rows = await this.select(`
      SELECT d.id, d.slug, d.name, t.slug AS type_slug
      FROM v2.destination d
      LEFT JOIN v2.destination_type_map m ON m.destination_id = d.id
      LEFT JOIN v2.destination_type t ON t.id = m.type_id
      WHERE d.status = 1
      ORDER BY d.name
    `);
    return groupSlugsByDestination(rows, "type_slug").map((g) => ({ ...g.destination, typeSlugs: g.slugs }));
  }

  async replaceTypeAssignments(destinationSlug: string, typeSlugs: readonly string[]): Promise<void> {
    // primary_type_id (dung hien badge/breadcrumb khong can join map) phai luon dong
    // bo voi type map — bug phat hien 24/07/2026: gan Type qua Kanban/AI truoc day
    // chi ghi type map, de primary_type_id NULL vinh vien du da co Type. Slug DAU TIEN
    // trong mang duoc coi la "chinh" (thu tu nguoi goi truyen vao — Kanban toggle
    // hoac AI suggest deu giu nguyen thu tu nay).
    await this.db.transaction(async (query) => {
      const destinationId = await this.findDestinationIdBySlug(query, destinationSlug);
      if (destinationId === null) return;
      const params = { destinationId, typeSlugs: [...typeSlugs], primaryTypeSlug: typeSlugs[0] ?? null };
      await query(`DELETE FROM v2.destination_type_map WHERE destination_id = @destinationId`, params);
      await query(
        `INSERT INTO v2.destination_type_map (destination_id, type_id)
         SELECT @destinationId::int, id FROM v2.destination_type WHERE slug = ANY(@typeSlugs::text[])`,
        params,
      );
      await query(
        `UPDATE v2.destination
         SET primary_type_id = (SELECT id FROM v2.destination_type WHERE slug = @primaryTypeSlug)
         WHERE id = @destinationId`,
        params,
      );
    });
  }

  /** Coverage Score (spec §2.2.2) — 1 truy van tinh san cac co, tranh N+1 query tren ~271 diem */
  async fetchContentCoverageRows(): Promise<SiteContentCoverageRow[]> {
    const rows = await this.select(`
      SELECT d.id,
        coalesce(char_length(c.opening_time), 0) > 0 AS has_opening_time,
        coalesce(char_length(c.ticket_price), 0) > 0 AS has_ticket_price,
        coalesce(char_length(c.faq_json), 0) > 2 AS has_faq,
        coalesce(char_length(c.practical_notes_json), 0) > 2 AS has_practical_notes,
        coalesce(char_length(c.ticket_links_json), 0) > 2 AS has_ticket_links,
        coalesce(char_length(c.content_html), 0) > 300 AS has_main_content,
        coalesce(char_length(c.gallery_json), 0) > 2 AS has_gallery,
        c.content_updated_at,
        c.last_verified_at
      FROM v2.destination d
      LEFT JOIN v2.destination_content c ON c.destination_id = d.id
      WHERE d.status = 1
    `);
    return rows.map((r) => ({
      destinationId: Number(r.id),
      hasOpeningTime: Boolean(r.has_opening_time),
      hasTicketPrice: Boolean(r.has_ticket_price),
      hasFaq: Boolean(r.has_faq),
      hasPracticalNotes: Boolean(r.has_practical_notes),
      hasTicketLinks: Boolean(r.has_ticket_links),
      hasMainContent: Boolean(r.has_main_content),
      hasGallery: Boolean(r.has_gallery),
      contentUpdatedAt: toDateOrNull(r.content_updated_at),
      lastVerifiedAt: toDateOrNull(r.last_verified_at),
    }));
  }

  /** Coverage Score Flagship — muc "do phu bai cam nang theo topic" (Phase 28.6) */
  async fetchArticleTopicCoverage(): Promise<string[]> {
    const rows = await this.select(`
      SELECT DISTINCT m.destination_slug
      FROM v2.article_destination_map m
      JOIN v2.article a ON a.id = m.article_id
      WHERE a.status = 1
    `);
    return rows.map((r) => r.destination_slug as string);
  }

  private async select(sqlText: string, params: NamedParams = {}): Promise<Record<string, unknown>[]> {
    const { rows } = await this.db.query<Record<string, unknown>>(sqlText, params);
    return rows;
  }

  private async selectAutoLinkTargets(sqlText: string, params: NamedParams): Promise<AutoLinkTargetRow[]> {
    const rows = await this.select(sqlText, params);
    return rows.map((r) => ({ slug: r.slug as string, name: r.name as string }));
  }

  /** `column` luon la hang so trong file nay — KHONG bao gio lay tu input nguoi dung. */
  private async updateContentColumn(siteId: number, column: string, value: string | null): Promise<void> {
    await this.db.query(`UPDATE v2.destination_content SET ${column} = @value WHERE destination_id = @siteId`, {
      siteId,
      value,
    });
  }

  private async updateContentColumnIfChanged(siteId: number, column: string, value: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE v2.destination_content SET ${column} = @value
       WHERE destination_id = @siteId AND ${column} IS DISTINCT FROM @value`,
      { siteId, value },
    );
    return rowCount > 0;
  }

  private async insertMentionedRelations(
    query: SiteDbTransactionQuery,
    sourceSiteId: number,
    targetSiteIds: readonly number[],
  ): Promise<void> {
    if (targetSiteIds.length === 0) return;
    // ON CONFLICT: da co quan he cung loai (vd nhap tay) thi giu nguyen, khong nem loi PK
    await query(
      `INSERT INTO v2.destination_relation (source_id, target_id, relation_type, weight, is_auto)
       SELECT @sourceId::int, d.id, @relationType::smallint, 0, true
       FROM v2.destination d WHERE d.id = ANY(@targetIds::int[])
       ON CONFLICT (source_id, relation_type, target_id) DO NOTHING`,
      { sourceId: sourceSiteId, targetIds: [...targetSiteIds], relationType: MENTIONED_RELATION_TYPE },
    );
  }

  private async findDestinationIdBySlug(
    query: SiteDbTransactionQuery,
    slug: string,
  ): Promise<number | null> {
    const { rows } = await query<{ id: number }>(`SELECT id FROM v2.destination WHERE slug = @slug`, { slug });
    return rows[0]?.id ?? null;
  }
}

function toMetaParams(meta: SiteDestinationMeta): Record<string, unknown> {
  return {
    slug: meta.slug,
    kind: NUMBER_BY_KIND[meta.kind],
    parentSlug: meta.parentSlug,
    provinceCode: meta.provinceCode,
    name: meta.name,
    nameUnaccented: meta.nameUnaccented,
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
  };
}

function toDestinationCard(r: Record<string, unknown>): DestinationCardRow {
  return {
    slug: r.slug as string,
    name: r.name as string,
    shortDescription: (r.short_description as string | null) ?? null,
    thumbnail: (r.thumbnail as string | null) ?? null,
    kind: KIND_BY_NUMBER[r.kind as number] ?? "poi",
  };
}

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value as string);
}

/** Gom ket qua LEFT JOIN (1 dong / cap diem-slug) thanh 1 phan tu / diem den, giu thu tu. */
function groupSlugsByDestination(
  rows: readonly Record<string, unknown>[],
  slugColumn: string,
): Array<{ destination: { destinationId: number; destinationSlug: string; destinationName: string }; slugs: string[] }> {
  const byDestination = new Map<
    number,
    { destination: { destinationId: number; destinationSlug: string; destinationName: string }; slugs: string[] }
  >();
  for (const r of rows) {
    const id = Number(r.id);
    let entry = byDestination.get(id);
    if (!entry) {
      entry = {
        destination: { destinationId: id, destinationSlug: r.slug as string, destinationName: r.name as string },
        slugs: [],
      };
      byDestination.set(id, entry);
    }
    const slug = r[slugColumn] as string | null;
    if (slug) entry.slugs.push(slug);
  }
  return [...byDestination.values()];
}
