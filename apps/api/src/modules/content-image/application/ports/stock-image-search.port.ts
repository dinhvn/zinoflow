export const STOCK_IMAGE_SEARCH = Symbol("STOCK_IMAGE_SEARCH");

export interface StockImageCandidate {
  readonly imageUrl: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly photographer: string | null;
}

/**
 * Tim anh minh hoa CHUNG qua API anh mien phi co giay phep thuong mai ro rang
 * (dichoithoi-auto-image-search-plan.md §1.1) — KHONG search web mo/Google
 * Images. Adapter mac dinh: Pexels. Boc qua interface rieng (khac quyet dinh
 * KHONG tach token cho ImageUploader) vi rui ro provider doi dieu khoan/tat API
 * cao hon.
 */
export interface StockImageSearchPort {
  /** Tra ve toi da `limit` anh ung vien cho 1 tu khoa — rong neu khong tim thay
   * hoac provider chua cau hinh key (KHONG nem loi cho truong hop 0 ket qua). */
  search(keyword: string, limit: number): Promise<StockImageCandidate[]>;
}
