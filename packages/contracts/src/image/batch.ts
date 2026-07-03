import type { BatchConfig } from "./batch-config";
import type { ImageAspect, ImageFit } from "./primitives";
import type { ImageProps } from "./image-props";
import type { ProductCell } from "./product";

/**
 * Chia batch + build ImageProps — spec §7, §9.
 * N san pham, k/anh -> ceil(N/k) anh; o cuoi thieu thi anh cuoi co < k san pham.
 */

/** Cat danh sach san pham thanh tung anh (cua so k). Giu nguyen thu tu working set. */
export function splitProductsIntoImages(products: ProductCell[], perImage: number): ProductCell[][] {
  if (perImage < 1) throw new Error("perImage phai >= 1");
  const chunks: ProductCell[][] = [];
  for (let i = 0; i < products.length; i += perImage) {
    chunks.push(products.slice(i, i + perImage));
  }
  return chunks;
}

/** So anh se tao ra tu N san pham voi k/anh. */
export function countImages(total: number, perImage: number): number {
  if (perImage < 1) throw new Error("perImage phai >= 1");
  return Math.ceil(total / perImage);
}

/**
 * Resolve imageFit cho 1 o: override rieng o > global batch — spec §7.1.
 * Dung CHUNG o Player va worker de parity.
 */
export function resolveImageFit(cell: Pick<ProductCell, "imageFitOverride">, batch: ImageFit): ImageFit {
  return cell.imageFitOverride ?? batch;
}

/**
 * Build ImageProps[] tu working set + BatchConfig (global) + template/aspect/perImage.
 * Moi item = 1 anh, da merge config global -> dung cho ca preview va export.
 */
export function buildImageProps(args: {
  products: ProductCell[];
  templateId: string;
  aspect: ImageAspect;
  perImage: number;
  config: BatchConfig;
}): ImageProps[] {
  const { products, templateId, aspect, perImage, config } = args;
  return splitProductsIntoImages(products, perImage).map((cells) => ({
    templateId,
    aspect,
    perImage,
    products: cells,
    style: config.style,
    visibility: config.visibility,
    logo: config.logo,
    imageFit: config.imageFit,
  }));
}
