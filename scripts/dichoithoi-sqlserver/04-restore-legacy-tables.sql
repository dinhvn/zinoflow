/*
  Dichoithoi — RESTORE 2 bang goc v1 tu ban backup da tao boi
  03-backup-legacy-tables.sql. Dung khi go-live that gap su co can quay lai
  trang thai truoc migration (Phase 10, rollback).

  KHONG DROP bang dang chay hien tai — doi ten sang "_broken_<timestamp>"
  truoc (de dang xem lai neu can), roi doi ten ban backup ve dung ten goc.
  Vi vay script nay AN TOAN de chay kem ca khi khong chac chan co su co
  that hay khong.

  BAT BUOC: sua @suffix ben duoi dung ngay backup (yyyyMMdd) truoc khi chay.
*/

SET NOCOUNT ON;
DECLARE @suffix varchar(8) = '20260101'; -- SUA gia tri nay = hau to backup can phuc hoi
DECLARE @sql nvarchar(max);
DECLARE @brokenSuffix varchar(20) = CONVERT(varchar(20), GETDATE(), 112)
  + REPLACE(CONVERT(varchar(8), GETDATE(), 108), ':', '');
DECLARE @destBroken sysname = 'Destination_broken_' + @brokenSuffix;
DECLARE @detailBroken sysname = 'DestinationDetail_broken_' + @brokenSuffix;
DECLARE @destBackup sysname = 'Destination_backup_' + @suffix;
DECLARE @detailBackup sysname = 'DestinationDetail_backup_' + @suffix;

IF OBJECT_ID('dbo.' + @destBackup) IS NULL
BEGIN
  RAISERROR('Khong tim thay dbo.%s — kiem tra lai @suffix', 16, 1, @destBackup);
  RETURN;
END
IF OBJECT_ID('dbo.' + @detailBackup) IS NULL
BEGIN
  RAISERROR('Khong tim thay dbo.%s — kiem tra lai @suffix', 16, 1, @detailBackup);
  RETURN;
END

IF OBJECT_ID('dbo.Destination') IS NOT NULL
  EXEC sp_rename 'dbo.Destination', @destBroken;
EXEC sp_rename @destBackup, 'Destination';

IF OBJECT_ID('dbo.DestinationDetail') IS NOT NULL
  EXEC sp_rename 'dbo.DestinationDetail', @detailBroken;
EXEC sp_rename @detailBackup, 'DestinationDetail';

PRINT 'Da phuc hoi tu backup hau to ' + @suffix + '. Bang cu (neu co) da doi ten sang hau to _broken_' + @brokenSuffix + ' — xoa tay sau khi xac nhan on.';

SET @sql = N'
SELECT ''dbo.Destination'' AS TableName, COUNT(*) AS RowCount_ FROM dbo.Destination
UNION ALL
SELECT ''dbo.DestinationDetail'', COUNT(*) FROM dbo.DestinationDetail;';
EXEC sp_executesql @sql;
