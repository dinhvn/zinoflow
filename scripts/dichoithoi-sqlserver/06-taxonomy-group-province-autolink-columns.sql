/*
  Dichoithoi — them cot DescriptionHtml cho v2.DestinationTypeGroup + v2.Province
  (mo rong auto-link tu chi Type/Tag sang ca Group/Province, 07/2026).
  Xem 05-taxonomy-meta-autolink-columns.sql (Type/Tag) — cung pattern, cung ly do:
  DescriptionHtml la ban Description da auto-link (link toi cac diem den thuc su xuat
  hien tren chinh trang danh muc do). Description goc van la nguon sach, khong bi ghi de.

  Idempotent — chay lai an toan (dung style 01-create-new-schema.sql).
*/

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('v2.DestinationTypeGroup', 'DescriptionHtml') IS NULL
  ALTER TABLE v2.DestinationTypeGroup ADD DescriptionHtml nvarchar(max) NULL;
GO

IF COL_LENGTH('v2.Province', 'DescriptionHtml') IS NULL
  ALTER TABLE v2.Province ADD DescriptionHtml nvarchar(max) NULL;
GO
