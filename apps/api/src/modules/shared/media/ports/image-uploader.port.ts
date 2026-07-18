/**
 * Port day file anh len hosting dichoithoi (spec §14.1.1, §14.3 giai doan 2;
 * §14.5 — dung chung cho Hotel/Tour/Product ingest anh tu URL ngoai, backlog
 * §B Phase C muc 3). Adapter FTP/FTPS (basic-ftp) o infrastructure — credentials
 * qua env `{baseDirEnvVar}` (moi module co 1 thu muc goc rieng tren hosting).
 */
export const IMAGE_UPLOADER = Symbol("IMAGE_UPLOADER");

/** 1 file can day len — path TUONG DOI voi thu muc goc anh cua module goi */
export interface UploadFile {
  /** VD "nui-ham-rong/nui-ham-rong-thumb.webp" — se tao thu muc con neu chua co */
  path: string;
  body: Buffer;
  contentType: string;
}

export interface ImageUploader {
  /**
   * Day nhieu file len hosting trong 1 phien ket noi; tu tao thu muc con.
   * Nem UpstreamApiError khi thieu cau hinh hoac ket noi loi (co timeout).
   *
   * @param baseDirEnvVar ten bien env chua thu muc goc FTP cho module nay
   *   (vd "DICHOITHOI_FTP_BASE_DIR" cho diem den, "DICHOITHOI_FTP_HOTEL_BASE_DIR"
   *   cho khach san...). Mac dinh "DICHOITHOI_FTP_BASE_DIR" (giu nguyen hanh vi cu).
   */
  upload(files: UploadFile[], baseDirEnvVar?: string): Promise<void>;

  /**
   * Xoa nhieu file da upload (vd anh bi loai khoi thu vien). Best-effort —
   * khong nem loi khi 1 file khong ton tai/xoa that bai, chi log canh bao,
   * de khong chan viec luu danh sach gallery moi.
   */
  remove(paths: string[], baseDirEnvVar?: string): Promise<void>;
}
