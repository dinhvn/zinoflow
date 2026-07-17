import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type * as sql from "mssql";
import { UpstreamApiError } from "../../../shared/errors/app-error";

/**
 * Chon driver theo host: LocalDB (sandbox dev) can msnodesqlv8 (named pipe),
 * server thuong (production site4now) dung tedious. KHONG require ca 2 cung luc
 * — chung shared state trong package mssql.
 */
function isLocalDbHost(host: string): boolean {
  return host.toLowerCase().startsWith("(localdb)");
}

function loadMssqlDriver(host: string): typeof sql {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return isLocalDbHost(host) ? require("mssql/msnodesqlv8") : require("mssql");
}
import type { SiteDestinationRow } from "../../domain/destination-mirror";
import type {
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
  group: "v2.DestinationTypeGroup",
  type: "v2.DestinationType",
  province: "v2.Province",
};

const SORT_COLUMN: Record<DestinationCardFilter["sort"], string> = {
  featured: "d.Priority ASC, d.[Order] ASC",
  newest: "d.CreatedAt DESC",
  order: "d.[Order] ASC",
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

/**
 * Adapter SQL Server cua website dichoithoi (schema MOI — redesign doc §4).
 * - Lazy connect: chi mo pool khi can, dong khi shutdown.
 * - Timeout 15s + retry 2 lan co backoff (rule external call).
 * - CHI module nay duoc dung mssql — application layer khong biet SQL Server.
 */
@Injectable()
export class MssqlSiteDbAdapter implements DichoithoiSiteDb, OnModuleDestroy {
  private readonly logger = new Logger(MssqlSiteDbAdapter.name);
  private pool: sql.ConnectionPool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.DICHOITHOI_DB_HOST && process.env.DICHOITHOI_DB_USER);
  }

  async fetchAllDestinations(): Promise<SiteDestinationRow[]> {
    const result = await this.queryWithRetry<Record<string, unknown>>(`
      SELECT
        d.Id, d.Slug, d.Kind, d.Name, d.ShortDescription, d.Thumbnail,
        d.Lat, d.Lng, d.GoogleMapsUrl, d.AddressNew, d.AddressOld, d.ContactPhone, d.ContactWebsite,
        d.HotelGroupId, d.Priority, d.ContentTier, d.[Order], d.DistanceFromCenter,
        d.Status, d.ContentSource, d.UpdatedAt,
        p.Code AS ProvinceCode,
        par.Slug AS ParentSlug,
        c.TicketPrice,
        CONVERT(varchar(64), HASHBYTES('SHA2_256', CAST(c.ContentHtml AS nvarchar(max))), 2) AS ContentHash,
        (
          SELECT STRING_AGG(t.Slug, ',')
          FROM v2.DestinationTypeMap m
          JOIN v2.DestinationType t ON t.Id = m.TypeId
          WHERE m.DestinationId = d.Id
        ) AS TypesCsv
      FROM v2.Destination d
      LEFT JOIN v2.Destination par ON par.Id = d.ParentId
      LEFT JOIN v2.Province p ON p.Id = d.ProvinceId
      LEFT JOIN v2.DestinationContent c ON c.DestinationId = d.Id
    `);
    return result.map((r) => ({
      siteId: r.Id as number,
      slug: r.Slug as string,
      kind: KIND_BY_NUMBER[r.Kind as number] ?? "poi",
      parentSlug: (r.ParentSlug as string | null) ?? null,
      provinceCode: (r.ProvinceCode as string | null) ?? null,
      name: r.Name as string,
      shortDescription: (r.ShortDescription as string | null) ?? null,
      thumbnail: (r.Thumbnail as string | null) ?? null,
      lat: r.Lat === null ? null : Number(r.Lat),
      lng: r.Lng === null ? null : Number(r.Lng),
      googleMapsUrl: (r.GoogleMapsUrl as string | null) ?? null,
      addressNew: (r.AddressNew as string | null) ?? null,
      addressOld: (r.AddressOld as string | null) ?? null,
      contactPhone: (r.ContactPhone as string | null) ?? null,
      contactWebsite: (r.ContactWebsite as string | null) ?? null,
      hotelGroupId: (r.HotelGroupId as string | null) ?? null,
      priority: Number(r.Priority),
      contentTier: (r.ContentTier as "flagship" | "standard" | null) ?? null,
      order: Number(r.Order ?? 0),
      distanceFromCenter: r.DistanceFromCenter === null ? null : Number(r.DistanceFromCenter),
      siteStatus: Number(r.Status),
      contentSource: r.ContentSource === null ? null : Number(r.ContentSource),
      contentHash: (r.ContentHash as string | null) ?? null,
      siteUpdatedAt: r.UpdatedAt ? new Date(r.UpdatedAt as string) : null,
      ticketPrice: (r.TicketPrice as string | null) ?? null,
      types: r.TypesCsv ? String(r.TypesCsv).split(",") : [],
    }));
  }

  async fetchDestinationContent(siteId: number): Promise<SiteDestinationContent | null> {
    const rows = await this.queryWithRetry<Record<string, unknown>>(
      `SELECT ContentHtml, OpeningTime, TicketPrice, Transport, Food, HotelText, Tip
       FROM v2.DestinationContent WHERE DestinationId = ${Number(siteId)}`,
    );
    const r = rows[0];
    if (!r) return null;
    return {
      contentHtml: (r.ContentHtml as string) ?? "",
      openingTime: (r.OpeningTime as string | null) ?? null,
      ticketPrice: (r.TicketPrice as string | null) ?? null,
      transport: (r.Transport as string | null) ?? null,
      food: (r.Food as string | null) ?? null,
      hotel: (r.HotelText as string | null) ?? null,
      tip: (r.Tip as string | null) ?? null,
    };
  }

  async fetchProvinceSlugs(): Promise<Array<{ slug: string; code: string; name: string }>> {
    const rows = await this.queryWithRetry<{ Slug: string; Code: string; Name: string }>(
      `SELECT Slug, Code, Name FROM v2.Province ORDER BY Name`,
    );
    return rows.map((r) => ({ slug: r.Slug, code: r.Code, name: r.Name }));
  }

  async fetchTypes(): Promise<SiteTypeRow[]> {
    const rows = await this.queryWithRetry<{ Id: number; Slug: string; Name: string }>(
      `SELECT Id, Slug, Name FROM v2.DestinationType ORDER BY [Order], Name`,
    );
    // Driver SQL Server co the tra Id dang chuoi — ep ve number cho dung contract
    return rows.map((r) => ({ id: Number(r.Id), slug: r.Slug, name: r.Name }));
  }

  /**
   * Publish bai AI vao SQL Server — 1 batch co BEGIN TRAN/COMMIT + ROLLBACK khi loi
   * (tranh quirks transaction object giua tedious va msnodesqlv8). KHONG wipe:
   * update dong Destination co san + upsert DestinationContent theo DestinationId.
   */
  async publishDestination(input: PublishDestinationInput): Promise<{ contentHash: string }> {
    const targets = [...new Set(input.mentionedTargetSiteIds)].filter((id) => id !== input.siteId);
    const insertRelations = targets
      .map(
        (_, i) =>
          `INSERT INTO v2.DestinationRelation (SourceId, TargetId, RelationType, Weight, IsAuto)
           SELECT @siteId, @target${i}, 3, 0, 1
           WHERE EXISTS (SELECT 1 FROM v2.Destination WHERE Id = @target${i});`,
      )
      .join("\n");

    const rows = await this.runWithRetry<Array<{ ContentHash: string }>>(async (pool) => {
      const request = pool.request();
      request.input("siteId", input.siteId);
      request.input("title", input.title);
      request.input("thumbnail", input.thumbnail);
      request.input("shortDescription", input.shortDescription);
      request.input("searchKeyword", input.searchKeyword);
      request.input("contentHtml", input.contentHtml);
      request.input("openingTime", input.openingTime);
      request.input("ticketPrice", input.ticketPrice);
      request.input("transport", input.transport);
      request.input("food", input.food);
      request.input("hotel", input.hotel);
      request.input("tip", input.tip);
      request.input("faqJson", input.faqJson);
      request.input("ticketLinksJson", input.ticketLinksJson);
      request.input("priceBreakdownJson", input.priceBreakdownJson);
      request.input("practicalNotesJson", input.practicalNotesJson);
      request.input("galleryJson", input.galleryJson);
      request.input("metaTitle", input.metaTitle);
      request.input("metaDescription", input.metaDescription);
      targets.forEach((id, i) => request.input(`target${i}`, id));

      const result = await request.query<{ ContentHash: string }>(`
        SET XACT_ABORT ON;
        BEGIN TRAN;

        UPDATE v2.Destination SET
          ShortDescription = @shortDescription,
          SearchKeyword    = @searchKeyword,
          Thumbnail        = @thumbnail,
          ContentSource    = 1,
          UpdatedAt        = SYSUTCDATETIME()
        WHERE Id = @siteId;

        UPDATE v2.DestinationContent SET
          ContentHtml = @contentHtml, OpeningTime = @openingTime, TicketPrice = @ticketPrice,
          Transport = @transport, Food = @food, HotelText = @hotel, Tip = @tip,
          FaqJson = @faqJson, TicketLinksJson = @ticketLinksJson,
          PriceBreakdownJson = @priceBreakdownJson, PracticalNotesJson = @practicalNotesJson,
          GalleryJson = @galleryJson, Title = @title,
          MetaTitle = @metaTitle, MetaDescription = @metaDescription
        WHERE DestinationId = @siteId;
        IF @@ROWCOUNT = 0
          INSERT INTO v2.DestinationContent
            (DestinationId, ContentHtml, OpeningTime, TicketPrice, Transport, Food, HotelText,
             Tip, FaqJson, TicketLinksJson, PriceBreakdownJson, PracticalNotesJson, GalleryJson,
             Title, MetaTitle, MetaDescription)
          VALUES
            (@siteId, @contentHtml, @openingTime, @ticketPrice, @transport, @food, @hotel,
             @tip, @faqJson, @ticketLinksJson, @priceBreakdownJson, @practicalNotesJson,
             @galleryJson, @title, @metaTitle, @metaDescription);

        -- Quan he mentioned tu auto-link: thay toan bo dong auto cu cua nguon nay
        DELETE FROM v2.DestinationRelation
        WHERE SourceId = @siteId AND RelationType = 3 AND IsAuto = 1;
        ${insertRelations}

        COMMIT;

        SELECT CONVERT(varchar(64),
          HASHBYTES('SHA2_256', CAST(ContentHtml AS nvarchar(max))), 2) AS ContentHash
        FROM v2.DestinationContent WHERE DestinationId = @siteId;
      `);
      return result.recordset;
    });

    const contentHash = rows[0]?.ContentHash;
    if (!contentHash) {
      throw new UpstreamApiError(
        `Publish điểm đến siteId=${input.siteId} không ghi được nội dung (không thấy dòng DestinationContent sau khi ghi)`,
      );
    }
    return { contentHash };
  }

  async fetchAllContentRows(): Promise<SiteContentRow[]> {
    const rows = await this.queryWithRetry<{ Id: number; Slug: string; ContentHtml: string }>(`
      SELECT d.Id, d.Slug, c.ContentHtml
      FROM v2.DestinationContent c
      JOIN v2.Destination d ON d.Id = c.DestinationId
      WHERE d.Status = 1
    `);
    return rows.map((r) => ({ siteId: r.Id, slug: r.Slug, contentHtml: r.ContentHtml ?? "" }));
  }

  async updateContentHtml(siteId: number, contentHtml: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("contentHtml", contentHtml);
      return request.query(
        `UPDATE v2.DestinationContent SET ContentHtml = @contentHtml WHERE DestinationId = @siteId`,
      );
    });
  }

  async addMentionedRelations(
    sourceSiteId: number,
    targetSiteIds: readonly number[],
  ): Promise<void> {
    const targets = [...new Set(targetSiteIds)].filter((id) => id !== sourceSiteId);
    if (targets.length === 0) return;
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("sourceId", sourceSiteId);
      targets.forEach((id, i) => request.input(`target${i}`, id));
      const statements = targets
        .map(
          (_, i) =>
            `INSERT INTO v2.DestinationRelation (SourceId, TargetId, RelationType, Weight, IsAuto)
             SELECT @sourceId, @target${i}, 3, 0, 1
             WHERE NOT EXISTS (
               SELECT 1 FROM v2.DestinationRelation
               WHERE SourceId = @sourceId AND TargetId = @target${i} AND RelationType = 3
             );`,
        )
        .join("\n");
      return request.query(statements);
    });
  }

  async fetchSlugRedirects(): Promise<Map<string, string>> {
    const rows = await this.queryWithRetry<{ OldSlug: string; Slug: string }>(`
      SELECT r.OldSlug, d.Slug
      FROM v2.SlugRedirect r
      JOIN v2.Destination d ON d.Id = r.DestinationId
    `);
    return new Map(rows.map((r) => [r.OldSlug, r.Slug]));
  }

  async updateRelatedJson(siteId: number, relatedJson: string): Promise<boolean> {
    return this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("relatedJson", relatedJson);
      // Chi ghi khi gia tri doi — tranh write + invalidate cache vo ich (spec §12.3)
      const result = await request.query(`
        UPDATE v2.DestinationContent SET RelatedJson = @relatedJson
        WHERE DestinationId = @siteId
          AND (RelatedJson IS NULL OR RelatedJson <> @relatedJson)
      `);
      return (result.rowsAffected[0] ?? 0) > 0;
    });
  }

  async createDestination(meta: SiteDestinationMeta): Promise<{ siteId: number }> {
    const rows = await this.runWithRetry<Array<{ SiteId: number }>>(async (pool) => {
      const request = this.bindMeta(pool.request(), meta);
      const result = await request.query<{ SiteId: number }>(`
        DECLARE @parentId int = (SELECT Id FROM v2.Destination WHERE Slug = @parentSlug);
        DECLARE @provinceId int = (SELECT Id FROM v2.Province WHERE Code = @provinceCode);
        INSERT INTO v2.Destination
          (Slug, Kind, ParentId, ProvinceId, Name, NameUnaccented, ShortDescription, Thumbnail,
           Lat, Lng, GoogleMapsUrl, AddressNew, AddressOld, ContactPhone, ContactWebsite,
           HotelGroupId, Priority, ContentTier, Status, ContentSource)
        VALUES
          (@slug, @kind, @parentId, @provinceId, @name, @nameUnaccented,
           COALESCE(@shortDescription, N''), @thumbnail, @lat, @lng, @googleMapsUrl, @addressNew, @addressOld,
           @contactPhone, @contactWebsite, @hotelGroupId, @priority, @contentTier, 1, 1);
        SELECT CAST(SCOPE_IDENTITY() AS int) AS SiteId;
      `);
      return result.recordset;
    });
    const siteId = rows[0]?.SiteId;
    if (!siteId) {
      throw new UpstreamApiError(`Không tạo được điểm đến "${meta.slug}" trên SQL Server`);
    }
    return { siteId };
  }

  async updateMetadata(siteId: number, meta: SiteDestinationMeta): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = this.bindMeta(pool.request(), meta);
      request.input("siteId", siteId);
      return request.query(`
        DECLARE @parentId int = (SELECT Id FROM v2.Destination WHERE Slug = @parentSlug);
        DECLARE @provinceId int = (SELECT Id FROM v2.Province WHERE Code = @provinceCode);
        UPDATE v2.Destination SET
          Kind = @kind, ParentId = @parentId, ProvinceId = @provinceId,
          Name = @name, NameUnaccented = @nameUnaccented,
          ShortDescription = COALESCE(@shortDescription, N''), Thumbnail = @thumbnail,
          Lat = @lat, Lng = @lng, GoogleMapsUrl = @googleMapsUrl, AddressNew = @addressNew, AddressOld = @addressOld,
          ContactPhone = @contactPhone, ContactWebsite = @contactWebsite,
          HotelGroupId = @hotelGroupId, Priority = @priority, ContentTier = @contentTier,
          UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @siteId;
      `);
    });
  }

  async renameSlug(siteId: number, oldSlug: string, newSlug: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("oldSlug", oldSlug);
      request.input("newSlug", newSlug);
      return request.query(`
        SET XACT_ABORT ON;
        BEGIN TRAN;

        UPDATE v2.Destination SET Slug = @newSlug, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @siteId;

        UPDATE v2.ArticleDestinationMap SET DestinationSlug = @newSlug
        WHERE DestinationSlug = @oldSlug;

        IF EXISTS (SELECT 1 FROM v2.SlugRedirect WHERE OldSlug = @oldSlug)
          UPDATE v2.SlugRedirect SET DestinationId = @siteId WHERE OldSlug = @oldSlug;
        ELSE
          INSERT INTO v2.SlugRedirect (OldSlug, DestinationId) VALUES (@oldSlug, @siteId);

        COMMIT;
      `);
    });
  }

  /** Bind tham so metadata dung chung cho insert + update */
  private bindMeta(request: sql.Request, meta: SiteDestinationMeta): sql.Request {
    request.input("slug", meta.slug);
    request.input("kind", NUMBER_BY_KIND[meta.kind]);
    request.input("parentSlug", meta.parentSlug);
    request.input("provinceCode", meta.provinceCode);
    request.input("name", meta.name);
    request.input("nameUnaccented", meta.nameUnaccented);
    request.input("shortDescription", meta.shortDescription);
    request.input("thumbnail", meta.thumbnail);
    request.input("lat", meta.lat);
    request.input("lng", meta.lng);
    request.input("googleMapsUrl", meta.googleMapsUrl);
    request.input("addressNew", meta.addressNew);
    request.input("addressOld", meta.addressOld);
    request.input("contactPhone", meta.contactPhone);
    request.input("contactWebsite", meta.contactWebsite);
    request.input("hotelGroupId", meta.hotelGroupId);
    request.input("priority", meta.priority);
    request.input("contentTier", meta.contentTier);
    return request;
  }

  /** article-spec §3.1 khoi `destinations` — CHI diem da published (Status=1) */
  async findDestinationCards(filter: DestinationCardFilter): Promise<DestinationCardRow[]> {
    const conditions: string[] = ["d.Status = 1"];
    const rows = await this.runWithRetry<Array<Record<string, unknown>>>(async (pool) => {
      const request = pool.request();
      if (filter.typeSlug) {
        conditions.push(
          "EXISTS (SELECT 1 FROM v2.DestinationTypeMap m JOIN v2.DestinationType t ON t.Id = m.TypeId " +
            "WHERE m.DestinationId = d.Id AND t.Slug = @typeSlug)",
        );
        request.input("typeSlug", filter.typeSlug);
      }
      if (filter.provinceSlug) {
        conditions.push("p.Slug = @provinceSlug");
        request.input("provinceSlug", filter.provinceSlug);
      }
      if (filter.parentSlug) {
        conditions.push("par.Slug = @parentSlug");
        request.input("parentSlug", filter.parentSlug);
      }
      request.input("limit", filter.limit);
      const result = await request.query<Record<string, unknown>>(`
        SELECT TOP (@limit) d.Slug, d.Name, d.ShortDescription, d.Thumbnail, d.Kind
        FROM v2.Destination d
        LEFT JOIN v2.Province p ON p.Id = d.ProvinceId
        LEFT JOIN v2.Destination par ON par.Id = d.ParentId
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${SORT_COLUMN[filter.sort]}
      `);
      return result.recordset;
    });
    return rows.map((r) => ({
      slug: r.Slug as string,
      name: r.Name as string,
      shortDescription: (r.ShortDescription as string | null) ?? null,
      thumbnail: (r.Thumbnail as string | null) ?? null,
      kind: KIND_BY_NUMBER[r.Kind as number] ?? "poi",
    }));
  }

  async findDestinationCardBySlug(slug: string): Promise<DestinationCardRow | null> {
    const rows = await this.runWithRetry<Array<Record<string, unknown>>>(async (pool) => {
      const request = pool.request();
      request.input("slug", slug);
      const result = await request.query<Record<string, unknown>>(`
        SELECT Slug, Name, ShortDescription, Thumbnail, Kind
        FROM v2.Destination WHERE Slug = @slug AND Status = 1
      `);
      return result.recordset;
    });
    const r = rows[0];
    if (!r) return null;
    return {
      slug: r.Slug as string,
      name: r.Name as string,
      shortDescription: (r.ShortDescription as string | null) ?? null,
      thumbnail: (r.Thumbnail as string | null) ?? null,
      kind: KIND_BY_NUMBER[r.Kind as number] ?? "poi",
    };
  }

  /** Phase 18.2 — noi dung /loai, /tinh cho trang admin sua Description danh muc */
  async fetchTaxonomyContent(): Promise<TaxonomyContentRows> {
    const [groups, types, provinces] = await Promise.all([
      this.queryWithRetry<{ Id: number; Slug: string; Name: string; Description: string | null }>(
        `SELECT Id, Slug, Name, Description FROM v2.DestinationTypeGroup ORDER BY [Order], Name`,
      ),
      this.queryWithRetry<{
        Id: number;
        GroupId: number;
        Slug: string;
        Name: string;
        Description: string | null;
      }>(`SELECT Id, GroupId, Slug, Name, Description FROM v2.DestinationType ORDER BY [Order], Name`),
      this.queryWithRetry<{
        Id: number;
        Slug: string;
        Code: string;
        Name: string;
        Description: string | null;
      }>(`SELECT Id, Slug, Code, Name, Description FROM v2.Province ORDER BY Name`),
    ]);
    return {
      groups: groups.map((r) => ({
        id: Number(r.Id),
        slug: r.Slug,
        name: r.Name,
        description: r.Description ?? null,
      })),
      types: types.map((r) => ({
        id: Number(r.Id),
        groupId: Number(r.GroupId),
        slug: r.Slug,
        name: r.Name,
        description: r.Description ?? null,
      })),
      provinces: provinces.map((r) => ({
        id: Number(r.Id),
        slug: r.Slug,
        code: r.Code,
        name: r.Name,
        description: r.Description ?? null,
      })),
    };
  }

  /** Phase 18.2 — sua doan gioi thieu 1 group/type/province (content-seo-ux-plan §10.3) */
  async updateTaxonomyDescription(
    target: "group" | "type" | "province",
    id: number,
    description: string | null,
  ): Promise<void> {
    const table = TAXONOMY_TABLE_BY_TARGET[target];
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("id", id);
      request.input("description", description);
      return request.query(`UPDATE ${table} SET Description = @description WHERE Id = @id`);
    });
  }

  async updateAncestorsChildren(
    siteId: number,
    ancestorsJson: string,
    childrenJson: string,
  ): Promise<boolean> {
    return this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("ancestorsJson", ancestorsJson);
      request.input("childrenJson", childrenJson);
      // Chi ghi khi it nhat 1 cot doi gia tri — tranh write + invalidate cache vo ich
      const result = await request.query(`
        UPDATE v2.DestinationContent SET AncestorsJson = @ancestorsJson, ChildrenJson = @childrenJson
        WHERE DestinationId = @siteId
          AND (
            AncestorsJson IS NULL OR AncestorsJson <> @ancestorsJson
            OR ChildrenJson IS NULL OR ChildrenJson <> @childrenJson
          )
      `);
      return (result.rowsAffected[0] ?? 0) > 0;
    });
  }

  async updateHotelCards(siteId: number, hotelCardsJson: string): Promise<boolean> {
    return this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("hotelCardsJson", hotelCardsJson);
      const result = await request.query(`
        UPDATE v2.DestinationContent SET HotelCardsJson = @hotelCardsJson
        WHERE DestinationId = @siteId
          AND (HotelCardsJson IS NULL OR HotelCardsJson <> @hotelCardsJson)
      `);
      return (result.rowsAffected[0] ?? 0) > 0;
    });
  }

  async updateTourCards(siteId: number, tourCardsJson: string): Promise<boolean> {
    return this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("tourCardsJson", tourCardsJson);
      const result = await request.query(`
        UPDATE v2.DestinationContent SET TourCardsJson = @tourCardsJson
        WHERE DestinationId = @siteId
          AND (TourCardsJson IS NULL OR TourCardsJson <> @tourCardsJson)
      `);
      return (result.rowsAffected[0] ?? 0) > 0;
    });
  }

  async updateSouvenirProducts(siteId: number, souvenirProductsJson: string): Promise<boolean> {
    return this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("souvenirProductsJson", souvenirProductsJson);
      const result = await request.query(`
        UPDATE v2.DestinationContent SET SouvenirProductsJson = @souvenirProductsJson
        WHERE DestinationId = @siteId
          AND (SouvenirProductsJson IS NULL OR SouvenirProductsJson <> @souvenirProductsJson)
      `);
      return (result.rowsAffected[0] ?? 0) > 0;
    });
  }

  async updateThumbnail(siteId: number, thumbnail: string | null): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("thumbnail", thumbnail);
      return request.query(
        `UPDATE v2.Destination SET Thumbnail = @thumbnail, UpdatedAt = SYSUTCDATETIME()
         WHERE Id = @siteId`,
      );
    });
  }

  async updateTicketLinks(siteId: number, ticketLinksJson: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("ticketLinksJson", ticketLinksJson);
      return request.query(
        `UPDATE v2.DestinationContent SET TicketLinksJson = @ticketLinksJson WHERE DestinationId = @siteId`,
      );
    });
  }

  async updatePriceBreakdown(siteId: number, priceBreakdownJson: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("priceBreakdownJson", priceBreakdownJson);
      return request.query(
        `UPDATE v2.DestinationContent SET PriceBreakdownJson = @priceBreakdownJson WHERE DestinationId = @siteId`,
      );
    });
  }

  async updatePracticalNotes(siteId: number, practicalNotesJson: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("practicalNotesJson", practicalNotesJson);
      return request.query(
        `UPDATE v2.DestinationContent SET PracticalNotesJson = @practicalNotesJson WHERE DestinationId = @siteId`,
      );
    });
  }

  async updateEditorialReview(siteId: number, editorialReview: string | null): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("editorialReview", editorialReview);
      return request.query(
        `UPDATE v2.DestinationContent SET EditorialReview = @editorialReview WHERE DestinationId = @siteId`,
      );
    });
  }

  async updateMetaTitle(siteId: number, metaTitle: string | null): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("metaTitle", metaTitle);
      return request.query(`
        UPDATE v2.DestinationContent SET MetaTitle = @metaTitle WHERE DestinationId = @siteId;
        IF @@ROWCOUNT = 0
          INSERT INTO v2.DestinationContent (DestinationId, ContentHtml, MetaTitle)
          VALUES (@siteId, N'', @metaTitle);
      `);
    });
  }

  async updateExternalReviewUrls(siteId: number, externalReviewUrlsJson: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("externalReviewUrlsJson", externalReviewUrlsJson);
      return request.query(
        `UPDATE v2.DestinationContent SET ExternalReviewUrlsJson = @externalReviewUrlsJson WHERE DestinationId = @siteId`,
      );
    });
  }

  async updateGallery(siteId: number, galleryJson: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("galleryJson", galleryJson);
      return request.query(
        `UPDATE v2.DestinationContent SET GalleryJson = @galleryJson WHERE DestinationId = @siteId`,
      );
    });
  }

  /** destination-spec §2.4 buoc 0 — 7 tag seed san qua phase-b-01-seed-tags.sql */
  async fetchTags(): Promise<SiteTagRow[]> {
    const rows = await this.queryWithRetry<{
      Id: number;
      Slug: string;
      Name: string;
      Description: string | null;
      Status: number;
    }>(`SELECT Id, Slug, Name, Description, Status FROM v2.DestinationTag ORDER BY Name`);
    return rows.map((r) => ({
      id: Number(r.Id),
      slug: r.Slug,
      name: r.Name,
      description: r.Description ?? null,
      status: Number(r.Status),
    }));
  }

  async fetchTagAssignments(): Promise<SiteTagAssignmentRow[]> {
    const rows = await this.queryWithRetry<{
      Id: number;
      Slug: string;
      Name: string;
      TagSlug: string | null;
    }>(`
      SELECT d.Id, d.Slug, d.Name, t.Slug AS TagSlug
      FROM v2.Destination d
      LEFT JOIN v2.DestinationTagMap m ON m.DestinationId = d.Id
      LEFT JOIN v2.DestinationTag t ON t.Id = m.TagId
      WHERE d.Status = 1
      ORDER BY d.Name
    `);
    const byDestination = new Map<number, SiteTagAssignmentRow>();
    for (const r of rows) {
      const id = Number(r.Id);
      let entry = byDestination.get(id);
      if (!entry) {
        entry = { destinationId: id, destinationSlug: r.Slug, destinationName: r.Name, tagSlugs: [] };
        byDestination.set(id, entry);
      }
      if (r.TagSlug) entry.tagSlugs.push(r.TagSlug);
    }
    return [...byDestination.values()];
  }

  async replaceTagAssignments(destinationSlug: string, tagSlugs: readonly string[]): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("slug", destinationSlug);
      const uniqueSlugs = [...new Set(tagSlugs)];
      uniqueSlugs.forEach((slug, i) => request.input(`tag${i}`, slug));
      const insertRows = uniqueSlugs
        .map(
          (_, i) =>
            `SELECT @destinationId, Id FROM v2.DestinationTag WHERE Slug = @tag${i}`,
        )
        .join("\nUNION ALL\n");
      return request.query(`
        DECLARE @destinationId int = (SELECT Id FROM v2.Destination WHERE Slug = @slug);
        IF @destinationId IS NOT NULL
        BEGIN
          DELETE FROM v2.DestinationTagMap WHERE DestinationId = @destinationId;
          ${uniqueSlugs.length > 0 ? `INSERT INTO v2.DestinationTagMap (DestinationId, TagId)\n${insertRows}` : ""}
        END
      `);
    });
  }

  async updateTagDescription(tagSlug: string, description: string | null): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("slug", tagSlug);
      request.input("description", description);
      return request.query(
        `UPDATE v2.DestinationTag SET Description = @description WHERE Slug = @slug`,
      );
    });
  }

  async fetchTypeAssignments(): Promise<SiteTypeAssignmentRow[]> {
    const rows = await this.queryWithRetry<{
      Id: number;
      Slug: string;
      Name: string;
      TypeSlug: string | null;
    }>(`
      SELECT d.Id, d.Slug, d.Name, t.Slug AS TypeSlug
      FROM v2.Destination d
      LEFT JOIN v2.DestinationTypeMap m ON m.DestinationId = d.Id
      LEFT JOIN v2.DestinationType t ON t.Id = m.TypeId
      WHERE d.Status = 1
      ORDER BY d.Name
    `);
    const byDestination = new Map<number, SiteTypeAssignmentRow>();
    for (const r of rows) {
      const id = Number(r.Id);
      let entry = byDestination.get(id);
      if (!entry) {
        entry = { destinationId: id, destinationSlug: r.Slug, destinationName: r.Name, typeSlugs: [] };
        byDestination.set(id, entry);
      }
      if (r.TypeSlug) entry.typeSlugs.push(r.TypeSlug);
    }
    return [...byDestination.values()];
  }

  async replaceTypeAssignments(destinationSlug: string, typeSlugs: readonly string[]): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("slug", destinationSlug);
      typeSlugs.forEach((slug, i) => request.input(`type${i}`, slug));
      const insertValues = typeSlugs
        .map((_, i) => `SELECT @destinationId, Id FROM v2.DestinationType WHERE Slug = @type${i}`)
        .join("\nUNION ALL\n");
      await request.query(`
        DECLARE @destinationId int = (SELECT Id FROM v2.Destination WHERE Slug = @slug);
        IF @destinationId IS NOT NULL
        BEGIN
          DELETE FROM v2.DestinationTypeMap WHERE DestinationId = @destinationId;
          ${
            typeSlugs.length > 0
              ? `INSERT INTO v2.DestinationTypeMap (DestinationId, TypeId)\n${insertValues}`
              : ""
          }
        END
      `);
    });
  }

  /** Coverage Score (spec §2.2.2) — 1 truy van tinh san cac co, tranh N+1 query tren ~271 diem */
  async fetchContentCoverageRows(): Promise<SiteContentCoverageRow[]> {
    const rows = await this.queryWithRetry<{
      Id: number;
      HasOpeningTime: number;
      HasTicketPrice: number;
      HasFaq: number;
      HasPracticalNotes: number;
      HasTicketLinks: number;
      HasMainContent: number;
      HasGallery: number;
    }>(`
      SELECT d.Id,
        CASE WHEN c.OpeningTime IS NOT NULL AND LEN(c.OpeningTime) > 0 THEN 1 ELSE 0 END AS HasOpeningTime,
        CASE WHEN c.TicketPrice IS NOT NULL AND LEN(c.TicketPrice) > 0 THEN 1 ELSE 0 END AS HasTicketPrice,
        CASE WHEN c.FaqJson IS NOT NULL AND LEN(c.FaqJson) > 2 THEN 1 ELSE 0 END AS HasFaq,
        CASE WHEN c.PracticalNotesJson IS NOT NULL AND LEN(c.PracticalNotesJson) > 2 THEN 1 ELSE 0 END AS HasPracticalNotes,
        CASE WHEN c.TicketLinksJson IS NOT NULL AND LEN(c.TicketLinksJson) > 2 THEN 1 ELSE 0 END AS HasTicketLinks,
        CASE WHEN c.ContentHtml IS NOT NULL AND LEN(c.ContentHtml) > 300 THEN 1 ELSE 0 END AS HasMainContent,
        CASE WHEN c.GalleryJson IS NOT NULL AND LEN(c.GalleryJson) > 2 THEN 1 ELSE 0 END AS HasGallery
      FROM v2.Destination d
      LEFT JOIN v2.DestinationContent c ON c.DestinationId = d.Id
      WHERE d.Status = 1
    `);
    return rows.map((r) => ({
      destinationId: Number(r.Id),
      hasOpeningTime: Boolean(r.HasOpeningTime),
      hasTicketPrice: Boolean(r.HasTicketPrice),
      hasFaq: Boolean(r.HasFaq),
      hasPracticalNotes: Boolean(r.HasPracticalNotes),
      hasTicketLinks: Boolean(r.HasTicketLinks),
      hasMainContent: Boolean(r.HasMainContent),
      hasGallery: Boolean(r.HasGallery),
    }));
  }

  /** Coverage Score Flagship — muc "do phu bai cam nang theo topic" (Phase 28.6) */
  async fetchArticleTopicCoverage(): Promise<string[]> {
    const rows = await this.queryWithRetry<{ DestinationSlug: string }>(`
      SELECT DISTINCT m.DestinationSlug
      FROM v2.ArticleDestinationMap m
      JOIN v2.Article a ON a.Id = m.ArticleId
      WHERE a.Status = 1
    `);
    return rows.map((r) => r.DestinationSlug);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  private async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool?.connected) return this.pool;
    if (!this.isConfigured()) {
      throw new UpstreamApiError(
        "Chưa cấu hình kết nối database dichoithoi (DICHOITHOI_DB_* trong .env — xem .env.example)",
      );
    }
    const host = process.env.DICHOITHOI_DB_HOST ?? "";
    const driver = loadMssqlDriver(host);
    const config: sql.config = isLocalDbHost(host)
      ? // LocalDB sandbox: Windows auth qua ODBC
        ({
          connectionString:
            `Driver={ODBC Driver 17 for SQL Server};Server=${host};` +
            `Database=${process.env.DICHOITHOI_DB_NAME};Trusted_Connection=yes;`,
          connectionTimeout: 15_000,
          requestTimeout: 30_000,
          pool: { max: 4, min: 0 },
        } as unknown as sql.config)
      : {
          server: host,
          database: process.env.DICHOITHOI_DB_NAME ?? "",
          user: process.env.DICHOITHOI_DB_USER ?? "",
          password: process.env.DICHOITHOI_DB_PASSWORD ?? "",
          options: { encrypt: true, trustServerCertificate: true },
          connectionTimeout: 15_000,
          requestTimeout: 30_000,
          pool: { max: 4, min: 0 },
        };
    this.pool = await new driver.ConnectionPool(config).connect();
    this.logger.log(
      `Da ket noi SQL Server dichoithoi (${isLocalDbHost(host) ? "LocalDB sandbox" : host})`,
    );
    return this.pool;
  }

  private async queryWithRetry<T>(queryText: string): Promise<T[]> {
    const result = await this.runWithRetry((pool) => pool.request().query<T>(queryText));
    return result.recordset;
  }

  /** Retry 2 lan voi backoff 1s/3s cho loi mang/timeout (khong retry loi cu phap) */
  private async runWithRetry<T>(fn: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> {
    const delays = [0, 1_000, 3_000];
    let lastError: Error | null = null;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const pool = await this.getPool();
        return await fn(pool);
      } catch (err) {
        const error = err as Error & { code?: string; number?: number };
        lastError = error;
        // Loi schema (bang chua ton tai) khong retry — bao ro de chay migration.
        // tedious: error.number=208; msnodesqlv8 (ODBC): chi co message.
        if (error.number === 208 || /invalid object name/i.test(error.message)) {
          throw new UpstreamApiError(
            "Schema mới (v2) chưa được tạo trên SQL Server dichoithoi — chạy scripts/dichoithoi-sqlserver/01-create-new-schema.sql và 02-migrate-data.sql trước (SAU KHI BACKUP).",
          );
        }
        this.logger.warn(`Query site DB loi (se retry): ${error.message}`);
        // pool co the hong sau loi mang — bo de lan sau tao lai
        if (this.pool && !this.pool.connected) this.pool = null;
      }
    }
    throw new UpstreamApiError(
      `Không truy vấn được database dichoithoi: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}
