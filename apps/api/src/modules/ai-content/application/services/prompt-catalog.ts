/**
 * Catalog metadata cho prompt templates — single source mo ta MOI template key
 * co the quan ly: nhan hien thi, loai bai, operation, va bien {{...}} kha dung.
 *
 * Dung cho: man quan ly prompt (list + goi y bien + validate placeholder la).
 * Key + thu tu phai khop voi PROMPT_KEYS / DEFAULT_PROMPTS — prompt-catalog.spec.ts
 * gac de catalog khong lech voi DEFAULT_PROMPTS.
 */
import { PROMPT_KEYS, SYSTEM_PROMPT_KEY } from "./default-prompts";

/** Buoc trong pipeline 3 buoc + system message dung chung */
export type PromptOperation = "system" | "outline" | "section" | "frame";

/**
 * Loai bai co prompt rieng (khop articleTypeSchema). null = system dung chung.
 * "km-bai-viet": prompt CHUNG cho bai khuyenmai (laruki/dochoi3s) — site-aware qua {{siteCode}};
 * override per-site/postType (key "<site>.km-<postType>.<step>.vi") tao truc tiep qua DB (prompt-builder resolve).
 */
export type PromptArticleType =
  | "toplist"
  | "review"
  | "guide-diem-den"
  | "cam-nang"
  | "km-bai-viet";

export interface PromptCatalogEntry {
  key: string;
  /** null voi system prompt (dung chung moi loai bai) */
  articleType: PromptArticleType | null;
  operation: PromptOperation;
  label: string;
  /** Bien {{...}} hop le cho template nay (de goi y + canh bao placeholder la) */
  variables: string[];
}

const ARTICLE_TYPES: PromptArticleType[] = [
  "toplist",
  "review",
  "guide-diem-den",
  "cam-nang",
  "km-bai-viet",
];

export const ARTICLE_TYPE_LABELS: Record<PromptArticleType, string> = {
  toplist: "Top-list",
  review: "Review",
  "guide-diem-den": "Điểm đến (dichoithoi)",
  "cam-nang": "Cẩm nang tổng hợp (dichoithoi)",
  "km-bai-viet": "Khuyến mãi (laruki/dochoi3s)",
};

const OPERATION_LABELS: Record<PromptOperation, string> = {
  system: "System (giọng + nguyên tắc chung)",
  outline: "Outline (bước 1 — dàn ý)",
  section: "Section (bước 2 — viết từng mục)",
  frame: "Frame (bước 3 — khung + metadata)",
};

/** Bien chung moi prompt deu nhan (tu PromptBuilder.baseVars) */
const COMMON_VARS = [
  "topic",
  "keywords",
  "siteCode",
  "toneProfile",
  "sourceContext",
  "products",
  "currentDate",
];

/** Bien theo operation (= COMMON_VARS + extra moi buoc, theo PromptBuilder) */
const VARS_BY_OPERATION: Record<PromptOperation, string[]> = {
  system: [],
  outline: COMMON_VARS,
  section: [...COMMON_VARS, "title", "outline", "sectionHeading"],
  frame: [...COMMON_VARS, "title", "outline", "sectionsSummary"],
};

function entry(
  key: string,
  articleType: PromptArticleType | null,
  operation: PromptOperation,
): PromptCatalogEntry {
  const typeLabel = articleType ? `${ARTICLE_TYPE_LABELS[articleType]} · ` : "";
  return {
    key,
    articleType,
    operation,
    label: `${typeLabel}${OPERATION_LABELS[operation]}`,
    variables: VARS_BY_OPERATION[operation],
  };
}

/** Toan bo template quan ly duoc — system truoc, roi tung loai bai (outline/section/frame). */
export const PROMPT_CATALOG: readonly PromptCatalogEntry[] = [
  entry(SYSTEM_PROMPT_KEY, null, "system"),
  ...ARTICLE_TYPES.flatMap((type) => [
    entry(PROMPT_KEYS.outline(type), type, "outline"),
    entry(PROMPT_KEYS.section(type), type, "section"),
    entry(PROMPT_KEYS.frame(type), type, "frame"),
  ]),
];

const CATALOG_BY_KEY = new Map(PROMPT_CATALOG.map((e) => [e.key, e]));

export function findCatalogEntry(key: string): PromptCatalogEntry | undefined {
  return CATALOG_BY_KEY.get(key);
}

/**
 * Placeholder {{x}} trong template KHONG thuoc danh sach bien hop le cua key —
 * canh bao (khong chan): renderer giu nguyen placeholder la trong prompt.
 */
export function findUnknownPlaceholders(content: string, allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  const found = new Set<string>();
  for (const match of content.matchAll(/\{\{(\w+)\}\}/g)) {
    const name = match[1]!;
    if (!allowedSet.has(name)) found.add(name);
  }
  return [...found];
}
