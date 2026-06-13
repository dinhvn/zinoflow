/**
 * Port lay text tu URL nguon tham khao (spec dichoithoi §3.6) — gia ve tu trang
 * ve chinh thuc, gio mo cua tu website diem den... Text duoc dua vao sourceContext
 * cua prompt kem URL de AI ghi chu nguon.
 * Implementation: infrastructure/reference/http-reference-fetcher.ts.
 */
export const REFERENCE_FETCHER = Symbol("REFERENCE_FETCHER");

export interface ReferenceFetcher {
  /**
   * Fetch tinh (khong headless browser — MVP) + boc text chinh, cat ngan.
   * Nem UpstreamApiError khi URL khong hop le/bi chan/timeout — caller quyet dinh
   * fail hay ghi chu "khong tai duoc" (trang chan bot -> nguoi dung nhap tay).
   */
  fetchText(url: string): Promise<string>;
}
