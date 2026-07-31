/* ===== Van chuyen (Ve xe khach mode=2, Ve may bay mode=1 du phong) =====
   Gan theo TUYEN co diem dung (khong theo POI) — khac Hotel/Tour vi khong co
   toa do/khoang cach, ma co vai tro (Role) khac nhau tren tung diem.
   Spec: docs/dichoithoi/dichoithoi-transport-vexekhach-plan.md §2. */

IF OBJECT_ID('v2.Transport') IS NULL
CREATE TABLE v2.Transport (
  Id            int IDENTITY PRIMARY KEY,
  Mode          tinyint       NOT NULL, -- 1 = may bay (du phong), 2 = xe khach
  OperatorName  nvarchar(256) NOT NULL,
  Phone         varchar(32)   NULL,
  VehicleType   nvarchar(64)  NULL,
  PriceFrom     decimal(12,0) NULL,
  ThumbnailUrl  varchar(512)  NULL,
  Provider      varchar(64)   NULL,
  SourceUrl     varchar(512)  NULL, -- tuy chon: nhieu nha xe nho chi co SDT
  AffiliateUrl  varchar(512)  NULL,
  LinkStatus    varchar(20)   NOT NULL DEFAULT 'no-rule', -- + 'no-link' khac Hotel/Tour
  Status        tinyint       NOT NULL DEFAULT 1,  -- 0 nhap, 1 published, 2 an
  CreatedAt     datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt     datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('v2.TransportStop') IS NULL
CREATE TABLE v2.TransportStop (
  TransportId   int NOT NULL REFERENCES v2.Transport(Id),
  DestinationId int NOT NULL REFERENCES v2.Destination(Id),
  Role          tinyint NOT NULL, -- 1 = origin, 2 = destination, 3 = waypoint
  SeqOrder      tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (TransportId, DestinationId)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_v2TransportStop_Destination')
  CREATE INDEX IX_v2TransportStop_Destination ON v2.TransportStop(DestinationId, Role)
    INCLUDE (TransportId, SeqOrder);
GO

/* Card "🚌 Vé xe khách" tren trang diem den — precompute boi zinoflow, cung
   pattern HotelCardsJson/TourCardsJson (Phase 15) — website CHI DOC, khong
   JOIN Transport/TransportStop song moi lan render (transport-plan §2). */
IF COL_LENGTH('v2.DestinationContent', 'TransportCardsJson') IS NULL
  ALTER TABLE v2.DestinationContent ADD TransportCardsJson nvarchar(max) NULL;
GO
