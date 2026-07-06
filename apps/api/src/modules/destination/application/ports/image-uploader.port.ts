/**
 * Port day file anh len hosting dichoithoi (spec §14.1.1, §14.3 giai doan 2).
 * Adapter FTP/FTPS (basic-ftp) o infrastructure — credentials qua env DICHOITHOI_FTP_*.
 */
export const IMAGE_UPLOADER = Symbol("IMAGE_UPLOADER");

/** 1 file can day len — path TUONG DOI voi thu muc goc anh (DICHOITHOI_FTP_BASE_DIR) */
export interface UploadFile {
  /** VD "nui-ham-rong/thumb.webp" — se tao thu muc con neu chua co */
  path: string;
  body: Buffer;
  contentType: string;
}

export interface ImageUploader {
  /**
   * Day nhieu file len hosting trong 1 phien ket noi; tu tao thu muc con.
   * Nem UpstreamApiError khi thieu cau hinh hoac ket noi loi (co timeout).
   */
  upload(files: UploadFile[]): Promise<void>;
}
