/*
  Dichoithoi — them cot Category cho v2.Article
  (dichoithoi-camnang-affiliate-overflow-plan.md, chot 31/07/2026).

  Danh muc bai cam nang, gan truc tiep tren bai (KHAC voi v2.ArticleDestinationMap.Topic,
  von gan theo tung cap bai-diem-den) — dung cho trang hub /cam-nang/danh-muc/{slug}
  + loc/lien ket bai lien quan. Gia tri: kinh-nghiem|lich-trinh|di-chuyen|an-uong|
  luu-tru|diem-tham-quan-vui-choi|mua-sam (khong CHECK constraint, giong quy uoc
  Topic — validate o app layer, xem packages/contracts/src/dichoithoi/article.ts).

  Idempotent - chay lai an toan (dung style 07-content-freshness-columns.sql).
*/

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('v2.Article', 'Category') IS NULL
  ALTER TABLE v2.Article ADD Category varchar(32) NULL;
GO
