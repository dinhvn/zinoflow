import { z } from "zod/v4";
import { imageAspectSchema, imageStyleSchema, visibilityFlagsSchema, logoOverlaySchema, imageFitSchema } from "./primitives";
import { productCellSchema } from "./product";

/**
 * ImageProps — props TRON VEN cho MOT anh. Spec §7.
 * Dung CHUNG cho Remotion Player (preview) va worker (export) -> dam bao parity.
 * = BatchConfig (style/visibility/logo/imageFit) + phan rieng (template/aspect/perImage/products).
 */
export const imagePropsSchema = z
  .object({
    templateId: z.string().min(1),
    aspect: imageAspectSchema,
    /** k — so san pham/anh, dung de chon grid (spec §6). */
    perImage: z.number().int().min(1).max(60),
    /** Da cat dung cho anh nay; products.length <= perImage. */
    products: z.array(productCellSchema),
    // ---- copy tu BatchConfig (global) ----
    style: imageStyleSchema,
    visibility: visibilityFlagsSchema,
    logo: logoOverlaySchema.nullable(),
    imageFit: imageFitSchema,
  })
  .refine((p) => p.products.length <= p.perImage, {
    message: "products.length phai <= perImage",
    path: ["products"],
  });
export type ImageProps = z.infer<typeof imagePropsSchema>;
