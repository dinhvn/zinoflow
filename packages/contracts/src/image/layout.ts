import type { ImageAspect } from "./primitives";
import type { GridLayout, GridRules, ImageTemplate } from "./template";

/**
 * Grid layout dong theo so san pham/anh (k) — spec §6.
 * Mapping k -> rows*cols la single source of truth, dung chung Player + worker.
 */

/** Preset mac dinh khi template khong dinh nghia rieng cho k. */
export const DEFAULT_GRID_PRESETS: Record<number, GridLayout> = {
  2: { rows: 1, cols: 2 },
  4: { rows: 2, cols: 2 },
  6: { rows: 2, cols: 3 },
  8: { rows: 2, cols: 4 },
  9: { rows: 3, cols: 3 },
  10: { rows: 2, cols: 5 },
  12: { rows: 3, cols: 4 },
  15: { rows: 3, cols: 5 },
  16: { rows: 4, cols: 4 },
  20: { rows: 4, cols: 5 },
};

/** Cac so san pham/anh duoc phep chon (co layout hop le). */
export const SUPPORTED_PER_IMAGE = Object.keys(DEFAULT_GRID_PRESETS)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Chon grid cho (perImage, aspect): uu tien rule cua template, fallback preset mac dinh,
 * cuoi cung suy ra grid "gan vuong" neu khong co preset.
 */
export function resolveGrid(
  perImage: number,
  aspect: ImageAspect,
  template?: Pick<ImageTemplate, "gridRules">,
): GridLayout {
  const fromTemplate = template?.gridRules?.[aspect] as GridRules | undefined;
  const ruled = fromTemplate?.[String(perImage)];
  if (ruled) return ruled;

  const preset = DEFAULT_GRID_PRESETS[perImage];
  if (preset) return preset;

  // Fallback: grid gan vuong (cols = ceil(sqrt(k)), rows = ceil(k/cols)).
  const cols = Math.ceil(Math.sqrt(perImage));
  const rows = Math.ceil(perImage / cols);
  return { rows, cols };
}
