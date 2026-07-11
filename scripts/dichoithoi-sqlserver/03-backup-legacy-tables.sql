/*
  Dichoithoi — BACKUP 2 bang goc v1 (dbo.Destination, dbo.DestinationDetail)
  TRUOC khi chay 01-create-new-schema.sql/02-migrate-data.sql that tren
  production (Phase 10 go-live, destination-spec Sec8, implementation-plan
  Phase 10 buoc 1).

  Dung SELECT ... INTO (table-level copy) thay vi BACKUP DATABASE — hosting
  share (SmarterASP) thuong KHONG cho quyen ghi file he thong cho BACKUP
  DATABASE. Ten bang backup gan hau to ngay chay (yyyyMMdd) de phan biet
  nhieu lan backup.

  Chay xong script nay: kiem tra COUNT(*) o phan cuoi khop 100% voi bang
  goc truoc khi tiep tuc buoc migration. Script doi xung
  04-restore-legacy-tables.sql dung khi can phuc hoi.
*/

SET NOCOUNT ON;
DECLARE @suffix varchar(8) = CONVERT(varchar(8), GETDATE(), 112); -- yyyyMMdd
DECLARE @sql nvarchar(max);

IF OBJECT_ID('dbo.Destination') IS NULL
BEGIN
  RAISERROR('dbo.Destination khong ton tai — kiem tra lai truoc khi backup', 16, 1);
  RETURN;
END
IF OBJECT_ID('dbo.DestinationDetail') IS NULL
BEGIN
  RAISERROR('dbo.DestinationDetail khong ton tai — kiem tra lai truoc khi backup', 16, 1);
  RETURN;
END

SET @sql = N'IF OBJECT_ID(''dbo.Destination_backup_' + @suffix + N''') IS NOT NULL
  DROP TABLE dbo.Destination_backup_' + @suffix + N';
SELECT * INTO dbo.Destination_backup_' + @suffix + N' FROM dbo.Destination;';
EXEC sp_executesql @sql;

SET @sql = N'IF OBJECT_ID(''dbo.DestinationDetail_backup_' + @suffix + N''') IS NOT NULL
  DROP TABLE dbo.DestinationDetail_backup_' + @suffix + N';
SELECT * INTO dbo.DestinationDetail_backup_' + @suffix + N' FROM dbo.DestinationDetail;';
EXEC sp_executesql @sql;

PRINT 'Backup xong voi hau to: ' + @suffix + ' — doi chieu COUNT(*) ben duoi truoc khi tiep tuc.';

SET @sql = N'
SELECT ''dbo.Destination'' AS TableName, COUNT(*) AS RowCount_ FROM dbo.Destination
UNION ALL
SELECT ''dbo.Destination_backup_' + @suffix + N''', COUNT(*) FROM dbo.Destination_backup_' + @suffix + N'
UNION ALL
SELECT ''dbo.DestinationDetail'', COUNT(*) FROM dbo.DestinationDetail
UNION ALL
SELECT ''dbo.DestinationDetail_backup_' + @suffix + N''', COUNT(*) FROM dbo.DestinationDetail_backup_' + @suffix + N';';
EXEC sp_executesql @sql;
