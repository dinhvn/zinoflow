import { z } from "zod/v4";

/**
 * Primitive value objects cho image tool (product collage) — spec image-tool §5, §7.
 * Tat ca transform luu dang CHUAN HOA (0..1 / -1..1 / ti le canh anh), KHONG px tuyet doi,
 * de Player (preview) va worker (export) render khop nhau o moi composition size.
 */

/** Loai anh / aspect ratio — quyet dinh composition size (spec §5). */
export const imageAspectSchema = z.enum(["square", "landscape", "portrait"]);
export type ImageAspect = z.infer<typeof imageAspectSchema>;

/** Kich thuoc render (px) theo aspect — single source of truth cho Player + worker. */
export const ASPECT_SIZES: Record<ImageAspect, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1350 },
};

/**
 * Canh anh trong o (object-fit: cover + transform) — spec §7.1.
 * scale: zoom (>=1, 1 = vua khit cover). offsetX/Y: keo theo % vung du (-1..1).
 * Anh dai thuong dung offsetY de chon phan hien thi.
 */
export const imageFitSchema = z.object({
  scale: z.number().min(1).max(4).default(1),
  offsetX: z.number().min(-1).max(1).default(0),
  offsetY: z.number().min(-1).max(1).default(0),
});
export type ImageFit = z.infer<typeof imageFitSchema>;

export const DEFAULT_IMAGE_FIT: ImageFit = { scale: 1, offsetX: 0, offsetY: 0 };

/**
 * Logo overlay — 1 logo thuong hieu de len ca anh (watermark) — spec §7.2.
 * x/y: vi tri tam logo theo % kich thuoc anh (0..1). scale: % canh anh (vd 0.2 = 20%).
 */
export const logoOverlaySchema = z.object({
  url: z.string().min(1),
  visible: z.boolean().default(true),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.08),
  scale: z.number().min(0.02).max(1).default(0.2),
});
export type LogoOverlay = z.infer<typeof logoOverlaySchema>;

/** Theme mau — toolbar NGANG (spec §7). */
export const imageStyleSchema = z.object({
  backgroundColor: z.string().default("#ffffff"),
  accentColor: z.string().default("#e11d48"),
  priceColor: z.string().default("#e11d48"),
  borderColor: z.string().default("#e5e7eb"),
  borderWidth: z.number().int().min(0).max(24).default(0),
  theme: z.string().default("light"),
});
export type ImageStyle = z.infer<typeof imageStyleSchema>;

/** Bat/tat hien thi thong tin — toolbar DOC (spec §7). Bat/tat logo nam o logo.visible. */
export const visibilityFlagsSchema = z.object({
  showName: z.boolean().default(true),
  showOriginalPrice: z.boolean().default(true),
  showSalePrice: z.boolean().default(true),
  showDiscountPercent: z.boolean().default(true),
  showBadge: z.boolean().default(true),
  showCellBorder: z.boolean().default(true),
});
export type VisibilityFlags = z.infer<typeof visibilityFlagsSchema>;
