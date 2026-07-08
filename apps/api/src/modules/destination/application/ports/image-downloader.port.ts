/**
 * Port lay anh nguon layout CU ve (job migrate anh — notes refactor §8 buoc 2).
 * Nhan duong dan TUONG DOI theo layout cu (vd "{slug}.webp"); impl tu ghep
 * voi nguon that su (thu muc local hoac base URL).
 */
export const IMAGE_DOWNLOADER = Symbol("IMAGE_DOWNLOADER");

export interface ImageDownloader {
  /** Lay 1 anh; null khi khong ton tai/loi doc (caller report, khong throw) */
  download(relativePath: string): Promise<Buffer | null>;
}
