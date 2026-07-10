/**
 * Port tai Google Sheet (chia se cong khai) ve dang CSV de import hang loat.
 * Implementation: infrastructure/reference/google-sheet-csv-fetcher.ts.
 */
export const SHEET_CSV_FETCHER = Symbol("SHEET_CSV_FETCHER");

export interface SheetCsvFetcher {
  /** Tra ve noi dung CSV cua sheet; nem UpstreamApiError neu URL sai/sheet chua cong khai */
  fetchCsv(url: string): Promise<string>;
}
