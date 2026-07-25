/*
  Dichoithoi — them cot MetaDescription (4 bang danh muc) + DescriptionHtml (Type, Tag).
  Ly do (24/07/2026, xem docs/dichoithoi/dichoithoi-content-seo-ux-plan.md):
  - MetaDescription: tach khoi Description (giong Destination.MetaDescription da tach
    khoi ShortDescription, database-redesign §4.3) — meta khong bao gio duoc doc tu ban
    da auto-link (co the chua <a>), tranh markup lot vao the <meta>.
  - DescriptionHtml: ban Description da auto-link toi cac diem den cung type/tag (auto-
    link engine ben zinoflow API — apps/api/src/modules/shared/text/auto-link.ts). Chi
    ap dung cho Type + Tag (Group/Province van hien thi Description thuan nhu cu).
    Description GOC van la nguon sach de admin sua trong CMS — KHONG bao gio bi ghi de
    boi ban co <a>, tranh lap lai loi da gap voi bullet/bold khong hien thi dung.

  Idempotent — chay lai an toan (dung style 01-create-new-schema.sql).
*/

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('v2.DestinationTypeGroup', 'MetaDescription') IS NULL
  ALTER TABLE v2.DestinationTypeGroup ADD MetaDescription nvarchar(160) NULL;
GO

IF COL_LENGTH('v2.DestinationType', 'MetaDescription') IS NULL
  ALTER TABLE v2.DestinationType ADD MetaDescription nvarchar(160) NULL;
GO
IF COL_LENGTH('v2.DestinationType', 'DescriptionHtml') IS NULL
  ALTER TABLE v2.DestinationType ADD DescriptionHtml nvarchar(max) NULL;
GO

IF COL_LENGTH('v2.Province', 'MetaDescription') IS NULL
  ALTER TABLE v2.Province ADD MetaDescription nvarchar(160) NULL;
GO

IF COL_LENGTH('v2.DestinationTag', 'MetaDescription') IS NULL
  ALTER TABLE v2.DestinationTag ADD MetaDescription nvarchar(160) NULL;
GO
IF COL_LENGTH('v2.DestinationTag', 'DescriptionHtml') IS NULL
  ALTER TABLE v2.DestinationTag ADD DescriptionHtml nvarchar(max) NULL;
GO
