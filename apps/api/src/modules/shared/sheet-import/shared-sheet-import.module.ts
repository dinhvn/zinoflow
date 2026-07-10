import { Module } from "@nestjs/common";
import { SHEET_CSV_FETCHER } from "./ports/sheet-csv-fetcher.port";
import { GoogleSheetCsvFetcher } from "./infrastructure/google-sheet-csv-fetcher";

/**
 * Tai Google Sheet cong khai ve CSV — dung chung cho import hang loat Destination/
 * Hotel/Tour/Product (product-spec §5.1, backlog §B Phase C muc 3/6).
 */
@Module({
  providers: [{ provide: SHEET_CSV_FETCHER, useClass: GoogleSheetCsvFetcher }],
  exports: [SHEET_CSV_FETCHER],
})
export class SharedSheetImportModule {}
