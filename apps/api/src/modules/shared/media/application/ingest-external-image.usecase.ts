import { Inject, Injectable, Logger } from "@nestjs/common";
import { UpstreamApiError } from "../../errors/app-error";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../ports/image-uploader.port";

const FETCH_TIMEOUT_MS = 15_000;
const MIN_BYTES = 1024; // loai anh 1x1 placeholder/loi tra ve trang html thay anh

export interface IngestedImagePaths {
  hero: string;
  medium: string;
  thumb: string;
}

/**
 * Ingest 1 anh tu URL ngoai (Shopee/Klook/OTA...) ve hosting cua minh — dung
 * chung cho Hotel/Tour/Product (dichoithoi-destination-spec.md §14.5, backlog
 * §B Phase C muc 3): KHONG hotlink, luon tai ve -> resize 3 co WebP -> FTP.
 *
 * Don gian hoa co y so voi thiet ke goc trong spec: chay DONG BO trong request
 * import/luu (khong qua pg-boss job rieng) — chap nhan duoc vi khoi luong MVP
 * nho (hotel-spec/tour-spec §7 "MVP nhap tay truoc, xay job khi du lon"); nang
 * cap thanh job bat dong bo khi so dong import lon den muc request bi cham.
 */
@Injectable()
export class IngestExternalImageUseCase {
  private readonly logger = new Logger(IngestExternalImageUseCase.name);

  constructor(
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
  ) {}

  /**
   * @param imageUrl link anh nguon ngoai (http/https)
   * @param destPrefix duong dan (khong duoi file) tren hosting, vd "khach-san/{id}/{id}"
   * @param baseDirEnvVar bien env chua thu muc goc FTP cua module goi (vd DICHOITHOI_FTP_HOTEL_BASE_DIR)
   */
  async execute(
    imageUrl: string,
    destPrefix: string,
    baseDirEnvVar: string,
  ): Promise<IngestedImagePaths> {
    const source = await this.download(imageUrl);
    const variants = await this.processor.toWebpVariants(source);
    const paths: IngestedImagePaths = {
      hero: `${destPrefix}-hero.webp`,
      medium: `${destPrefix}-medium.webp`,
      thumb: `${destPrefix}-thumb.webp`,
    };
    await this.uploader.upload(
      [
        { path: paths.hero, body: variants.hero, contentType: "image/webp" },
        { path: paths.medium, body: variants.medium, contentType: "image/webp" },
        { path: paths.thumb, body: variants.thumb, contentType: "image/webp" },
      ],
      baseDirEnvVar,
    );
    return paths;
  }

  private async download(imageUrl: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(imageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (err) {
      throw new UpstreamApiError(
        `Tải ảnh nguồn thất bại: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!response.ok) {
      throw new UpstreamApiError(`Tải ảnh nguồn thất bại: HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new UpstreamApiError(`URL không trả về ảnh (content-type: ${contentType || "?"})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < MIN_BYTES) {
      throw new UpstreamApiError("Ảnh tải về quá nhỏ, có thể là ảnh lỗi/placeholder");
    }
    return buffer;
  }
}
