/**
 * Parser thuan cho cu phap khoi dong `[[block:...]]` (dichoithoi-article-spec.md §3).
 * Dung chung boi quality gate (ai-content) va engine compile (module article) —
 * khong phu thuoc framework/DB, chi xu ly chuoi.
 */

export const BLOCK_KINDS = ["destinations", "hotels", "tours", "destination"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export interface ParsedBlockToken {
  /** Chuoi goc y het trong markdown, dung de thay the lai (vd tim-and-replace) */
  raw: string;
  /** Dong thu may (0-based) trong markdown nguon — dung de kiem tra H2/H3 phia tren */
  lineIndex: number;
  /** null neu kind khong nam trong BLOCK_KINDS (loi cu phap) */
  kind: BlockKind | null;
  params: Record<string, string>;
}

const TOKEN_LINE_RE = /^\[\[block:([a-z-]+)(?:\s+(.*))?\]\]$/;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 12;

function parseParams(paramsRaw: string | undefined): Record<string, string> {
  const params: Record<string, string> = {};
  if (!paramsRaw) return params;
  for (const match of paramsRaw.matchAll(/([a-z]+)=([^\s]+)/g)) {
    params[match[1]!] = match[2]!;
  }
  return params;
}

/** Tim moi dong khop cu phap token trong markdown (moi token PHAI nam RIENG 1 dong). */
export function parseBlockTokens(markdown: string): ParsedBlockToken[] {
  const lines = markdown.split("\n");
  const tokens: ParsedBlockToken[] = [];
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    const match = TOKEN_LINE_RE.exec(trimmed);
    if (!match) return;
    const kindRaw = match[1]!;
    const kind = (BLOCK_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as BlockKind)
      : null;
    tokens.push({ raw: trimmed, lineIndex, kind, params: parseParams(match[2]) });
  });
  return tokens;
}

/** limit mac dinh 8, toi da 12 (spec §3.1) */
export function resolveLimit(params: Record<string, string>): number {
  const raw = params.limit ? Number(params.limit) : DEFAULT_LIMIT;
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

/**
 * Token nao KHONG co dong H2/H3 (## hoac ###) ngay phia tren (bo qua dong
 * trong) — quality gate structure §6.2 (vet 07/2026, content-seo-ux-plan §8.3).
 */
export function findTokensMissingHeadingAbove(markdown: string): ParsedBlockToken[] {
  const lines = markdown.split("\n");
  const tokens = parseBlockTokens(markdown);
  return tokens.filter((token) => {
    let i = token.lineIndex - 1;
    while (i >= 0 && lines[i]!.trim() === "") i--;
    const prevLine = i >= 0 ? lines[i]!.trim() : "";
    return !/^#{2,3}\s/.test(prevLine);
  });
}
