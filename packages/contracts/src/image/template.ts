import { z } from "zod/v4";
import { imageAspectSchema } from "./primitives";
import { imageStyleSchema, visibilityFlagsSchema, logoOverlaySchema } from "./primitives";

/**
 * Template dinh san (preset bundle) — spec image-tool §5.1.
 * Chon template -> seed BatchConfig (style/visibility/logo) + grid rules + cell layout.
 * MVP: template la preset dung san trong shared composition package.
 */

/** Bo cuc tao/gia/badge trong 1 o. */
export const cellLayoutSchema = z.enum([
  "price-overlay", // gia de goc anh
  "caption-below", // ten + gia duoi anh
  "minimal", // chi anh + gia
]);
export type CellLayout = z.infer<typeof cellLayoutSchema>;

/** 1 cau hinh grid: so o = rows*cols. */
export const gridLayoutSchema = z.object({
  rows: z.number().int().min(1),
  cols: z.number().int().min(1),
});
export type GridLayout = z.infer<typeof gridLayoutSchema>;

/**
 * Mapping perImage (k) -> grid, theo tung aspect. Key la so san pham/anh dang string.
 * Vi du: { "12": { rows: 3, cols: 4 } }. Spec §6.
 */
export const gridRulesSchema = z.record(z.string(), gridLayoutSchema);
export type GridRules = z.infer<typeof gridRulesSchema>;

export const imageTemplateSchema = z.object({
  id: z.string(),
  code: z.string(),
  version: z.number().int().default(1),
  isActive: z.boolean().default(true),
  cellLayout: cellLayoutSchema,
  supportedAspects: z.array(imageAspectSchema).min(1),
  /**
   * Grid rules theo aspect (optional tung aspect): { square: {"12": {3,4}}, landscape: {...} }.
   * Thieu aspect/k -> fallback DEFAULT_GRID_PRESETS (layout.ts).
   */
  gridRules: z
    .object({
      square: gridRulesSchema.optional(),
      landscape: gridRulesSchema.optional(),
      portrait: gridRulesSchema.optional(),
    })
    .default({}),
  defaultStyle: imageStyleSchema,
  defaultVisibility: visibilityFlagsSchema,
  /** Logo mac dinh (vi tri/size); url co the rong de user gan sau. */
  defaultLogo: logoOverlaySchema.partial({ url: true }),
});
export type ImageTemplate = z.infer<typeof imageTemplateSchema>;
