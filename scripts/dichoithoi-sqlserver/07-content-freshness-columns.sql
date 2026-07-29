/*
  Dichoithoi — them 2 cot ContentUpdatedAt/LastVerifiedAt cho v2.DestinationContent
  (content-freshness-plan.md, Giai doan A, 29/07/2026).

  Thay the dong "updateNotice" AI viet cung luc generate (khong phan anh
  thuc te bai co duoc ra lai hay khong) bang 2 moc thoi gian tach biet:
  - ContentUpdatedAt: chi bump khi NOI DUNG THUC SU doi (gate so sanh gia
    tri + AI phan loai ContentHtml, xem PublishDestinationUseCase). Do ra
    badge + dateModified (JSON-LD) + lastmod (sitemap).
  - LastVerifiedAt: bump khi bien tap vien bam nut "Da kiem tra, van dung"
    du khong sua chu nao. CHI do vao badge, KHONG do vao dateModified/lastmod
    (tranh "date spam" - khong co content-diff that).

  KHONG dung v2.Destination.UpdatedAt san co - cot do bi nhieu thao tac
  khong lien quan noi dung dung vao (doi slug, batch tinh khoang cach cum,
  doi thumbnail...).

  Idempotent - chay lai an toan (dung style 06-taxonomy-group-province-autolink-columns.sql).
*/

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('v2.DestinationContent', 'ContentUpdatedAt') IS NULL
  ALTER TABLE v2.DestinationContent ADD ContentUpdatedAt datetime2 NULL;
GO

IF COL_LENGTH('v2.DestinationContent', 'LastVerifiedAt') IS NULL
  ALTER TABLE v2.DestinationContent ADD LastVerifiedAt datetime2 NULL;
GO
