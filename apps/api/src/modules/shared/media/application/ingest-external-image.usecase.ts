import { Inject, Injectable, Logger } from "@nestjs/common";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../ports/image-uploader.port";
import { downloadImageBuffer } from "./download-image";

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
    const source = await downloadImageBuffer(imageUrl);
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
}
