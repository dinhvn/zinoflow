import { Injectable } from "@nestjs/common";
import sharp from "sharp";
import type { ImageProcessor, WebpVariants } from "../ports/image-processor.port";

// 3 co co dinh (spec §14.2). hero cho dau bai/og:image, medium cho srcset, thumb cho card.
const WIDTHS = { hero: 1600, medium: 800, thumb: 400 } as const;
const WEBP_QUALITY = 80;

/**
 * Xu ly anh bang sharp: resize theo chieu rong + encode WebP.
 * withoutEnlargement = khong phong to anh goc nho hon (tranh vo net).
 */
@Injectable()
export class SharpImageProcessor implements ImageProcessor {
  async toWebpVariants(source: Buffer): Promise<WebpVariants> {
    const encode = (width: number): Promise<Buffer> =>
      sharp(source)
        .rotate() // ton trong EXIF orientation truoc khi resize
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

    const [hero, medium, thumb] = await Promise.all([
      encode(WIDTHS.hero),
      encode(WIDTHS.medium),
      encode(WIDTHS.thumb),
    ]);
    return { hero, medium, thumb };
  }
}
