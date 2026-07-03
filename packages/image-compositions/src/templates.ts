import {
  imageStyleSchema,
  visibilityFlagsSchema,
  type ImageTemplate,
  type CellLayout,
} from "@zinoflow/contracts";

/**
 * Template dinh san (preset bundle) — spec §5.1.
 * Day la single source of truth cho ca Player (preview) va worker (export).
 * MVP: hard-code vai preset; sau co the load tu DB.
 */
export const BUILT_IN_TEMPLATES: ImageTemplate[] = [
  {
    id: "sale-grid",
    code: "sale-grid",
    version: 1,
    isActive: true,
    cellLayout: "price-overlay",
    supportedAspects: ["square", "landscape", "portrait"],
    gridRules: {},
    defaultStyle: imageStyleSchema.parse({ accentColor: "#e11d48", priceColor: "#e11d48" }),
    defaultVisibility: visibilityFlagsSchema.parse({}),
    defaultLogo: { visible: true, x: 0.5, y: 0.07, scale: 0.18 },
  },
  {
    id: "catalog-caption",
    code: "catalog-caption",
    version: 1,
    isActive: true,
    cellLayout: "caption-below",
    supportedAspects: ["square", "landscape", "portrait"],
    gridRules: {},
    defaultStyle: imageStyleSchema.parse({ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderWidth: 2 }),
    defaultVisibility: visibilityFlagsSchema.parse({}),
    defaultLogo: { visible: true, x: 0.5, y: 0.06, scale: 0.16 },
  },
];

const TEMPLATE_MAP = new Map(BUILT_IN_TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): ImageTemplate | undefined {
  return TEMPLATE_MAP.get(id);
}

export function getCellLayout(templateId: string): CellLayout {
  return getTemplate(templateId)?.cellLayout ?? "caption-below";
}
