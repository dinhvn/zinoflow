/**
 * Port xu ly anh (spec §14.3 giai doan 2): convert anh nguon -> 3 co WebP.
 * Adapter thuc thi (sharp) nam o infrastructure — application khong biet thu vien.
 */
export const IMAGE_PROCESSOR = Symbol("IMAGE_PROCESSOR");

/** 3 bien the WebP theo convention folder-theo-slug (spec §14.1.3, §14.2) */
export interface WebpVariants {
  /** ~1600w — anh dau bai + og:image */
  hero: Buffer;
  /** ~800w — dung cho srcset */
  medium: Buffer;
  /** ~400w — card danh sach / related / search */
  thumb: Buffer;
}

export interface ImageProcessor {
  /**
   * Convert 1 anh nguon (buffer bat ky dinh dang sharp doc duoc) thanh 3 co WebP.
   * Khong phong to anh nho hon kich thuoc dich (withoutEnlargement).
   */
  toWebpVariants(source: Buffer): Promise<WebpVariants>;
  /**
   * Convert 1 anh nguon thanh DUNG 1 co WebP theo chieu rong tuy chon — dung cho
   * anh thu vien (gallery) chi can 1 kich thuoc, khac toWebpVariants (luon 3 co).
   */
  toWebp(source: Buffer, width: number): Promise<Buffer>;
  /** Doc kich thuoc thuc te 1 buffer anh — dung de ghi width/height <img> chong CLS
   * (content-image-library-plan §3.2). */
  getDimensions(source: Buffer): Promise<{ width: number; height: number }>;
}
