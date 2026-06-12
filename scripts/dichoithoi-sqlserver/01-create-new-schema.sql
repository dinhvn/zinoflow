/*
  Dichoithoi — DAI TU SCHEMA (buoc 1/2): tao bang MOI trong schema [v2].
  Theo docs/specs/dichoithoi-database-redesign.md §4.

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
    BookingUrl      varchar(512)  NULL,
    HotelGroupId    nvarchar(50)  NULL,
    IsFeatured      bit NOT NULL DEFAULT 0,
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
  MetaTitle       nvarchar(150) NULL,
  MetaDescription nvarchar(300) NULL
);
GO

/* ===== Loai diem den (redesign §4.4) ===== */
IF OBJECT_ID('v2.DestinationType') IS NULL
CREATE TABLE v2.DestinationType (
  Id      int IDENTITY PRIMARY KEY,
  Slug    varchar(64)   NOT NULL UNIQUE,        -- /loai/{slug}
  Name    nvarchar(128) NOT NULL,
  [Order] int NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('v2.DestinationTypeMap') IS NULL
CREATE TABLE v2.DestinationTypeMap (
  DestinationId int NOT NULL,
  TypeId        int NOT NULL,
  PRIMARY KEY (TypeId, DestinationId)           -- thu tu PK phuc vu "moi diem thuoc loai X"
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

PRINT N'01-create-new-schema.sql: xong — schema v2 da san sang. Chay tiep 02-migrate-data.sql';
