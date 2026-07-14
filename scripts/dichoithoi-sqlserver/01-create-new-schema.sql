/*
  Dichoithoi — DAI TU SCHEMA (buoc 1/2): tao bang MOI trong schema [v2].
  Theo docs/dichoithoi/dichoithoi-database-redesign.md §4.

  - CHI TAO MOI, khong dung vao bang cu — website hien tai van chay binh thuong.
  - Chay TRUOC: backup toan bo DB.
  - Chay xong: chay tiep 02-migrate-data.sql.
  - Khi website moi on dinh va da drop bang cu, co the chuyen ve dbo:
    ALTER SCHEMA dbo TRANSFER v2.Destination; (tung bang)
*/

-- Bat buoc cho filtered index (sqlcmd mac dinh QUOTED_IDENTIFIER OFF)
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'v2')
  EXEC('CREATE SCHEMA v2');
GO

/* ===== Province — 34 tinh/thanh sau sap nhap (redesign §4.1) ===== */
IF OBJECT_ID('v2.Province') IS NULL
CREATE TABLE v2.Province (
  Id            int IDENTITY PRIMARY KEY,
  Slug          varchar(64)   NOT NULL UNIQUE,
  Code          varchar(2)    NOT NULL UNIQUE,  -- ma dvhcvn ('01' HN, '79' HCM) — join voi admin tables ben AI tool
  Name          nvarchar(128) NOT NULL,
  Region        tinyint       NOT NULL,         -- 1 Bac, 2 Trung, 3 Nam
  OldNames      nvarchar(512) NULL,             -- ten cac tinh cu gop vao
  DestinationId int NULL,                       -- dong v2.Destination Kind=1 tuong ung
  [Order]       int NOT NULL DEFAULT 0
);
GO
-- Vay 07/2026 (Phase 18.2) — doan gioi thieu rieng cho trang /tinh/{slug}, tranh thin content (content-seo-ux-plan §10.3)
IF COL_LENGTH('v2.Province', 'Description') IS NULL
  ALTER TABLE v2.Province ADD Description nvarchar(max) NULL;
GO

/* ===== Destination — bang nong (redesign §4.2) ===== */
IF OBJECT_ID('v2.Destination') IS NULL
BEGIN
  CREATE TABLE v2.Destination (
    Id              int IDENTITY PRIMARY KEY,
    Slug            varchar(64)   NOT NULL,     -- giu NGUYEN gia tri slug cu -> URL khong doi
    Kind            tinyint       NOT NULL,     -- 1 province, 2 cluster, 3 poi
    ParentId        int NULL,
    ProvinceId      int NULL,
    PrimaryTypeId   int NULL,
    Name            nvarchar(128) NOT NULL,
    NameUnaccented  varchar(128)  NOT NULL,
    ShortDescription nvarchar(1000) NOT NULL DEFAULT N'',
    Thumbnail       varchar(256)  NULL,
    Lat             decimal(9,6)  NULL,
    Lng             decimal(9,6)  NULL,
    AddressNew      nvarchar(256) NULL,
    AddressOld      nvarchar(256) NULL,
    ContactPhone    varchar(32)   NULL,
    ContactWebsite  varchar(256)  NULL,
    ContactFacebook varchar(256)  NULL,          -- link Fanpage chinh chu (them 07/2026, database-redesign §4.2)
    HotelGroupId    nvarchar(50)  NULL,
    IsFeatured      bit NOT NULL DEFAULT 0,
    ContentTier     varchar(16)   NULL,           -- flagship|standard, chi Kind IN (1,2) (content-seo-ux-plan §10.6.1)
    [Order]         int NOT NULL DEFAULT 0,
    Status          tinyint NOT NULL DEFAULT 1, -- 0 draft, 1 published, 2 hidden
    ContentSource   tinyint NOT NULL DEFAULT 0, -- 0 viet tay, 1 AI
    ChildCount      smallint NOT NULL DEFAULT 0,
    ReviewCount     smallint NOT NULL DEFAULT 0,
    AvgRating       decimal(3,2) NULL,
    DistanceFromCenter decimal(18,0) NULL,
    SearchKeyword   nvarchar(256) NULL,
    CreatedAt       datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt       datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_v2Destination_Slug ON v2.Destination(Slug);
  -- covering index: trang tinh/cha-con/featured tra thang tu index (redesign §4.2)
  CREATE INDEX IX_v2Destination_Province ON v2.Destination(ProvinceId, Status, Kind)
    INCLUDE (Slug, Name, ShortDescription, Thumbnail, PrimaryTypeId, [Order]);
  CREATE INDEX IX_v2Destination_Parent ON v2.Destination(ParentId, Status)
    INCLUDE (Slug, Name, ShortDescription, Thumbnail, [Order]);
  CREATE INDEX IX_v2Destination_Featured ON v2.Destination(IsFeatured, [Order])
    WHERE IsFeatured = 1;
END
GO
-- Phase 21.5 (07/2026, audit sau commit cbd15c9), idempotent cho install cu
-- (da chay CREATE TABLE truoc khi 2 dong nay ton tai): BookingUrl la field
-- 1-link cu, da thay bang ticketLinks[] (DestinationContent.TicketLinksJson)
-- tu lau nhung cot van con trong DDL/entity, khong noi nao doc/ghi — xoa cho
-- dung thiet ke. ContactFacebook them lai theo database-redesign §4.2.
IF COL_LENGTH('v2.Destination', 'BookingUrl') IS NOT NULL
  ALTER TABLE v2.Destination DROP COLUMN BookingUrl;
IF COL_LENGTH('v2.Destination', 'ContactFacebook') IS NULL
  ALTER TABLE v2.Destination ADD ContactFacebook varchar(256) NULL;
GO
-- Phase 25 (07/2026): ContentTier — do uu tien noi dung, doc lap voi Kind
-- (content-seo-ux-plan §10.6.1). Idempotent cho install cu (bang da tao truoc).
IF COL_LENGTH('v2.Destination', 'ContentTier') IS NULL
  ALTER TABLE v2.Destination ADD ContentTier varchar(16) NULL;
GO
-- Vay 07/2026: link Google Maps nhap tay 1 lan — nguon duy nhat cho Lat/Lng tu
-- gio (UpsertDestinationUseCase tu parse lai moi lan cot nay doi), khong con
-- nhap tay Lat/Lng truc tiep qua form. Idempotent cho install cu.
IF COL_LENGTH('v2.Destination', 'GoogleMapsUrl') IS NULL
  ALTER TABLE v2.Destination ADD GoogleMapsUrl nvarchar(500) NULL;
GO

/* ===== DestinationContent — bang lanh 1-1 (redesign §4.3) ===== */
IF OBJECT_ID('v2.DestinationContent') IS NULL
CREATE TABLE v2.DestinationContent (
  DestinationId   int PRIMARY KEY,
  ContentHtml     nvarchar(max) NOT NULL,       -- HTML hoan chinh: sanitize + auto-link luc publish
  OpeningTime     nvarchar(512) NULL,
  TicketPrice     nvarchar(512) NULL,
  Transport       nvarchar(max) NULL,
  Food            nvarchar(max) NULL,
  Tip             nvarchar(max) NULL,
  HotelText       nvarchar(max) NULL,
  FaqJson         nvarchar(max) NULL,           -- [{q,a}] -> render FAQ + JSON-LD FAQPage
  RelatedJson     nvarchar(max) NULL,           -- precompute khoi lien quan (redesign §3.4)
  TicketLinksJson nvarchar(max) NULL,           -- [{provider,label,sourceUrl,affiliateUrl,linkStatus}] (redesign §4.3, vay 07/2026)
  GalleryJson     nvarchar(max) NULL,           -- [{path,altText,caption,credit}] (redesign §4.3, vay 07/2026)
  TicketPriceFrom decimal(12,0) NULL,           -- gia so cho JSON-LD offers/priceRange (redesign §4.3, vay 07/2026)
  MetaTitle       nvarchar(150) NULL,
  MetaDescription nvarchar(300) NULL
);
GO
-- Vay 07/2026 cho install cu da co bang truoc khi them 3 cot tren (idempotent)
IF COL_LENGTH('v2.DestinationContent', 'TicketLinksJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD TicketLinksJson nvarchar(max) NULL;
IF COL_LENGTH('v2.DestinationContent', 'GalleryJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD GalleryJson nvarchar(max) NULL;
IF COL_LENGTH('v2.DestinationContent', 'TicketPriceFrom') IS NULL
  ALTER TABLE v2.DestinationContent ADD TicketPriceFrom decimal(12,0) NULL;
GO
-- Phase 12 (07/2026): gia ve theo doi tuong (nhap tay) + luu y thuc te (AI goi y,
-- nguoi dung duyet) — content-seo-ux-plan §5.5a/§5.7. Idempotent cho install cu.
IF COL_LENGTH('v2.DestinationContent', 'PriceBreakdownJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD PriceBreakdownJson nvarchar(max) NULL;
IF COL_LENGTH('v2.DestinationContent', 'PracticalNotesJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD PracticalNotesJson nvarchar(max) NULL;
GO
-- Phase 28.0 (07/2026): lich trinh goi y (nhap tay) + danh gia bien tap (AI
-- goi y, nguoi dung duyet) + link Google Maps/TripAdvisor... (nhap tay) —
-- content-seo-ux-plan §10.6.2, destination-spec §2.2 khoi #10/#15. Idempotent.
IF COL_LENGTH('v2.DestinationContent', 'ItineraryJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD ItineraryJson nvarchar(max) NULL;
IF COL_LENGTH('v2.DestinationContent', 'EditorialReview') IS NULL
  ALTER TABLE v2.DestinationContent ADD EditorialReview nvarchar(1000) NULL;
IF COL_LENGTH('v2.DestinationContent', 'ExternalReviewUrlsJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD ExternalReviewUrlsJson nvarchar(max) NULL;
GO
-- Phase 14 (07/2026): breadcrumb + danh sach con precompute (database-redesign §3.4).
-- Tach rieng RelatedJson (goi y, cat 8, tron nhieu nguon) vi day la cay cau truc
-- THAT, khong cat, khong tron nguon.
IF COL_LENGTH('v2.DestinationContent', 'AncestorsJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD AncestorsJson nvarchar(max) NULL;
IF COL_LENGTH('v2.DestinationContent', 'ChildrenJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD ChildrenJson nvarchar(max) NULL;
GO
-- Phase 15 (07/2026): precompute the Hotel/Tour card cho trang detail — website
-- doc thang cot nay thay vi JOIN+ORDER BY+TAKE song moi lan render (database-
-- redesign §3.4/§4.3). Tinh lai 2 chieu: publish destination VA khi Hotel/Tour
-- doi gia/rating/mapping (RecomputeHotelCardsUseCase/RecomputeTourCardsUseCase).
IF COL_LENGTH('v2.DestinationContent', 'HotelCardsJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD HotelCardsJson nvarchar(max) NULL;
IF COL_LENGTH('v2.DestinationContent', 'TourCardsJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD TourCardsJson nvarchar(max) NULL;
GO
-- Phase 27 (07/2026) — "Qua mang ve" MVP: card san pham khop tag=slug diem den
-- (Product.tags — khong bang map rieng, khac Hotel/Tour), tinh khi Product
-- upsert/import (RecomputeSouvenirProductsUseCase), website chi echo HTML.
IF COL_LENGTH('v2.DestinationContent', 'SouvenirProductsJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD SouvenirProductsJson nvarchar(max) NULL;
GO

/* ===== Loai diem den — 2 tang (redesign §3.2, §4.4, vay 07/2026) ===== */
IF OBJECT_ID('v2.DestinationTypeGroup') IS NULL
CREATE TABLE v2.DestinationTypeGroup (
  Id      int IDENTITY PRIMARY KEY,
  Slug    varchar(64)   NOT NULL UNIQUE,        -- /loai/{slug} — trang nhom (pillar)
  Name    nvarchar(128) NOT NULL,
  [Order] int NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('v2.DestinationType') IS NULL
CREATE TABLE v2.DestinationType (
  Id      int IDENTITY PRIMARY KEY,
  GroupId int NOT NULL REFERENCES v2.DestinationTypeGroup(Id),
  Slug    varchar(64)   NOT NULL UNIQUE,        -- /loai/{groupSlug}/{slug}
  Name    nvarchar(128) NOT NULL,
  [Order] int NOT NULL DEFAULT 0
);
GO
-- Vay 07/2026 cho install cu da co v2.DestinationType truoc khi co GroupId (idempotent)
IF COL_LENGTH('v2.DestinationType', 'GroupId') IS NULL
BEGIN
  ALTER TABLE v2.DestinationType ADD GroupId int NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_v2DestinationType_Group')
BEGIN
  ALTER TABLE v2.DestinationType WITH NOCHECK ADD CONSTRAINT FK_v2DestinationType_Group
    FOREIGN KEY (GroupId) REFERENCES v2.DestinationTypeGroup(Id);
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_v2DestinationType_Group')
  CREATE INDEX IX_v2DestinationType_Group ON v2.DestinationType(GroupId, [Order]);
GO
-- Vay 07/2026 (Phase 18.2) — doan gioi thieu rieng cho trang /loai, /loai/{group}, /loai/{group}/{type}
IF COL_LENGTH('v2.DestinationTypeGroup', 'Description') IS NULL
  ALTER TABLE v2.DestinationTypeGroup ADD Description nvarchar(max) NULL;
GO
IF COL_LENGTH('v2.DestinationType', 'Description') IS NULL
  ALTER TABLE v2.DestinationType ADD Description nvarchar(max) NULL;
GO

IF OBJECT_ID('v2.DestinationTypeMap') IS NULL
CREATE TABLE v2.DestinationTypeMap (
  DestinationId int NOT NULL,
  TypeId        int NOT NULL,
  PRIMARY KEY (TypeId, DestinationId)           -- thu tu PK phuc vu "moi diem thuoc loai X"
);
GO

/* ===== Tag chu de (destination-spec §2.4) — bo sung 07/2026, tach khoi Type
   (Type = phan loai vat ly co dinh; Tag = chu de gan tay, 1 diem co nhieu tag) ===== */
IF OBJECT_ID('v2.DestinationTag') IS NULL
CREATE TABLE v2.DestinationTag (
  Id          int IDENTITY PRIMARY KEY,
  Slug        varchar(64)   NOT NULL UNIQUE,
  Name        nvarchar(128) NOT NULL,
  Description nvarchar(max) NULL,
  Status      tinyint       NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('v2.DestinationTagMap') IS NULL
CREATE TABLE v2.DestinationTagMap (
  DestinationId int NOT NULL REFERENCES v2.Destination(Id),
  TagId         int NOT NULL REFERENCES v2.DestinationTag(Id),
  PRIMARY KEY (DestinationId, TagId)
);
GO

/* ===== Quan he + redirect (redesign §4.5) ===== */
IF OBJECT_ID('v2.DestinationRelation') IS NULL
BEGIN
  CREATE TABLE v2.DestinationRelation (
    SourceId     int NOT NULL,
    TargetId     int NOT NULL,
    RelationType tinyint NOT NULL,              -- 1 nearby, 2 related, 3 mentioned
    Weight       smallint NOT NULL DEFAULT 0,   -- nearby: khoang cach met; related: do uu tien
    IsAuto       bit NOT NULL DEFAULT 1,
    CreatedAt    datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (SourceId, RelationType, TargetId)
  );
  CREATE INDEX IX_v2Relation_Target ON v2.DestinationRelation(TargetId, RelationType);
END
GO

IF OBJECT_ID('v2.SlugRedirect') IS NULL
CREATE TABLE v2.SlugRedirect (
  OldSlug       varchar(64) PRIMARY KEY,
  DestinationId int NOT NULL
);
GO

/* ===== Review — cau truc cu + FK int (redesign §4.6) ===== */
IF OBJECT_ID('v2.DestinationReview') IS NULL
BEGIN
  CREATE TABLE v2.DestinationReview (
    Id            int IDENTITY PRIMARY KEY,
    DestinationId int NOT NULL,
    UserId        int NULL,
    Name          nvarchar(128) NULL,
    Email         nvarchar(64) NULL,
    Rating        int NOT NULL,
    Comment       nvarchar(max) NULL,
    IsAdmin       bit NOT NULL DEFAULT 0,
    IsApproved    bit NOT NULL DEFAULT 0,
    DateCreated   datetime NOT NULL,
    DateApproved  datetime NULL
  );
  CREATE INDEX IX_v2Review_Destination ON v2.DestinationReview(DestinationId, IsApproved)
    INCLUDE (Name, Rating, DateCreated);
END
GO

/* ===== Hotel — khoi goi y tren trang diem den (hotel-spec §3/§4, them 07/2026) =====
   Card gia tri: khong can trang rieng, khong qua 2 chot duyet — publish thang. */
IF OBJECT_ID('v2.Hotel') IS NULL
CREATE TABLE v2.Hotel (
  Id            int IDENTITY PRIMARY KEY,
  Name          nvarchar(256) NOT NULL,
  Address       nvarchar(512) NULL,
  Lat           decimal(9,6)  NULL,
  Lng           decimal(9,6)  NULL,
  ProvinceId    int NULL REFERENCES v2.Province(Id),
  PriceFrom     decimal(12,0) NULL,
  Rating        decimal(2,1)  NULL,
  ReviewCount   int NULL,
  ThumbnailUrl  varchar(512)  NULL,
  ImagesJson    nvarchar(max) NULL,
  Provider      varchar(64)   NULL,
  SourceUrl     varchar(512)  NOT NULL,
  AffiliateUrl  varchar(512)  NULL,
  LinkStatus    varchar(20)   NOT NULL DEFAULT 'no-rule',
  Status        tinyint       NOT NULL DEFAULT 1,  -- 0 nhap, 1 published, 2 an
  CreatedAt     datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt     datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('v2.HotelDestinationMap') IS NULL
CREATE TABLE v2.HotelDestinationMap (
  HotelId       int NOT NULL REFERENCES v2.Hotel(Id),
  DestinationId int NOT NULL REFERENCES v2.Destination(Id),
  DistanceM     int NULL,
  IsManual      bit NOT NULL DEFAULT 0,
  PRIMARY KEY (HotelId, DestinationId)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_v2HotelMap_Destination')
  CREATE INDEX IX_v2HotelMap_Destination ON v2.HotelDestinationMap(DestinationId)
    INCLUDE (HotelId, DistanceM, IsManual);
GO

/* ===== Tour — khoi goi y tren trang diem den (tour-spec §3/§4, them 07/2026) =====
   Giong Hotel nhung KHONG co lat/lng rieng (gan qua map), them thoi luong/diem khoi hanh. */
IF OBJECT_ID('v2.Tour') IS NULL
CREATE TABLE v2.Tour (
  Id              int IDENTITY PRIMARY KEY,
  Name            nvarchar(256) NOT NULL,
  ShortDescription nvarchar(500) NULL,
  DurationDays    smallint NULL,
  DurationNights  smallint NULL,
  DepartureFrom   nvarchar(256) NULL,
  ProvinceId      int NULL REFERENCES v2.Province(Id),
  PriceFrom       decimal(12,0) NULL,
  Rating          decimal(2,1)  NULL,
  ReviewCount     int NULL,
  ThumbnailUrl    varchar(512)  NULL,
  ImagesJson      nvarchar(max) NULL,
  Provider        varchar(64)   NULL,
  SourceUrl       varchar(512)  NOT NULL,
  AffiliateUrl    varchar(512)  NULL,
  LinkStatus      varchar(20)   NOT NULL DEFAULT 'no-rule',
  Status          tinyint       NOT NULL DEFAULT 1,  -- 0 nhap, 1 published, 2 an
  CreatedAt       datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt       datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('v2.TourDestinationMap') IS NULL
CREATE TABLE v2.TourDestinationMap (
  TourId        int NOT NULL REFERENCES v2.Tour(Id),
  DestinationId int NOT NULL REFERENCES v2.Destination(Id),
  IsPrimary     bit NOT NULL DEFAULT 0,
  IsManual      bit NOT NULL DEFAULT 0,
  PRIMARY KEY (TourId, DestinationId)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_v2TourMap_Destination')
  CREATE INDEX IX_v2TourMap_Destination ON v2.TourDestinationMap(DestinationId)
    INCLUDE (TourId, IsPrimary);
GO

/* ===== Article — bai cam nang/listicle, khoi dong compile san (article-spec §8) ===== */
IF OBJECT_ID('v2.Article') IS NULL
CREATE TABLE v2.Article (
  Id              int IDENTITY PRIMARY KEY,
  Slug            varchar(128)  NOT NULL UNIQUE,     -- /cam-nang/{slug}
  Title           nvarchar(200) NOT NULL,
  ShortDescription nvarchar(500) NULL,
  Thumbnail       varchar(256)  NULL,
  ContentHtml     nvarchar(max) NOT NULL,             -- DA compile khoi dong — website chi doc field nay
  MetaTitle       nvarchar(150) NULL,
  MetaDescription nvarchar(300) NULL,
  Status          tinyint       NOT NULL DEFAULT 1,   -- 0 draft, 1 published, 2 hidden
  PublishedAt     datetime2     NULL,
  UpdatedAt       datetime2     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* ===== ArticleDestinationMap — quan he NGUOC Article -> Destination (article-spec §8.1, Phase 26) =====
   Trang diem den can biet co bai cam nang nao viet ve minh de hien link ra.
   Khong FK cung toi Destination (khac site DB truoc day, gio cung schema
   nhung giu pattern nhu Hotel/TourDestinationMap cho nhat quan). */
IF OBJECT_ID('v2.ArticleDestinationMap') IS NULL
CREATE TABLE v2.ArticleDestinationMap (
  ArticleId        int           NOT NULL REFERENCES v2.Article(Id),
  DestinationSlug  varchar(64)   NOT NULL,
  Topic            varchar(20)   NOT NULL,   -- itinerary|food|souvenir|nightlife|poi-guide|general
  [Order]          int           NOT NULL DEFAULT 0,
  PRIMARY KEY (ArticleId, DestinationSlug, Topic)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ArticleDestinationMap_Slug')
  CREATE INDEX IX_ArticleDestinationMap_Slug ON v2.ArticleDestinationMap(DestinationSlug, Topic);
GO

PRINT N'01-create-new-schema.sql: xong — schema v2 da san sang. Chay tiep 02-migrate-data.sql';
