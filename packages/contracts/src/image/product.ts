import { z } from "zod/v4";
import { imageFitSchema } from "./primitives";

/**
 * San pham trong image tool — spec image-tool §7, §12.
 * ProductCell la du lieu mot o trong anh collage. Nguon: CMS cu /api/v1/product/search.
 */

/** Badge hien thi tren o san pham. */
export const productBadgeSchema = z.enum(["new", "hot", "sale", "fixed"]);
export type ProductBadge = z.infer<typeof productBadgeSchema>;

/** 1 o san pham trong anh collage (da normalize, anh URL tuyet doi). */
export const productCellSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().min(1),
  originalPrice: z.number().nonnegative().nullable().default(null),
  salePrice: z.number().nonnegative().nullable().default(null),
  discountPercent: z.number().min(0).max(100).nullable().default(null),
  badges: z.array(productBadgeSchema).default([]),
  /** null = dung imageFit global; co = override rieng o nay (spec §7.1). */
  imageFitOverride: imageFitSchema.nullable().default(null),
});
export type ProductCell = z.infer<typeof productCellSchema>;

/**
 * Query tim san pham — UI goi thang CMS cu qua adapter (spec §12).
 * Field filter bam theo Tool/Index.cshtml cu.
 */
export const productSearchQuerySchema = z.object({
  keyword: z.string().optional(),
  supplierCode: z.string().optional(),
  categoryCode: z.string().optional(),
  isDiscount: z.coerce.boolean().optional(),
  isNew: z.coerce.boolean().optional(),
  isHot: z.coerce.boolean().optional(),
  isChanged: z.coerce.boolean().optional(),
  isFixedProduct: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;

export const productSearchResultSchema = z.object({
  items: z.array(productCellSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;
