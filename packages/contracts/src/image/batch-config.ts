import { z } from "zod/v4";
import {
  imageStyleSchema,
  visibilityFlagsSchema,
  logoOverlaySchema,
  imageFitSchema,
} from "./primitives";

/**
 * BatchConfig — cau hinh GLOBAL ap cho ca batch (spec §7).
 * 2 toolbar (ngang = style, doc = visibility) + logo overlay + imageFit deu sua object nay.
 * Doi 1 lan -> moi anh trong batch doi ngay (preview) va export theo.
 */
export const batchConfigSchema = z.object({
  style: imageStyleSchema,
  visibility: visibilityFlagsSchema,
  logo: logoOverlaySchema.nullable().default(null),
  imageFit: imageFitSchema,
});
export type BatchConfig = z.infer<typeof batchConfigSchema>;
