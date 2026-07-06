/**
 * Port tai anh tu hosting ve (job migrate anh layout cu — notes refactor §8 buoc 2).
 * Nhan URL DAY DU (use case tu ghep base + path qua ImageChecker.buildUrl).
 */
export const IMAGE_DOWNLOADER = Symbol("IMAGE_DOWNLOADER");

export interface ImageDownloader {
  /** Tai 1 anh; null khi 404/loi mang (caller report, khong throw) */
  download(url: string): Promise<Buffer | null>;
}
