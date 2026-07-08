/**
 * Match san pham voi tham so token `[[block:products tag=... category=...]]`
 * (dichoithoi-product-spec.md §4). Pure TS + unit tests — dung boi
 * ArticleBlockCompiler, khong phu thuoc framework/DB.
 */

export interface ProductCandidate {
  id: string;
  name: string;
  category: string;
  tags: readonly string[];
  status: number;
  createdAt: Date;
}

export interface MatchProductsInput {
  /** Tag can khop — OR (chi can trung 1 tag la du, chot 07/2026) */
  tags: readonly string[];
  /** Loc them theo category (tuy chon) */
  category?: string;
  limit: number;
}

/**
 * San pham published, khop >=1 tag (VA category neu co chi dinh), sap xep
 * theo SO TAG KHOP giam dan, roi moi nhat truoc (khong co truong featured
 * o Product — khac Hotel/Tour), cat du `limit`.
 */
export function matchProducts(
  candidates: readonly ProductCandidate[],
  input: MatchProductsInput,
): ProductCandidate[] {
  const requestedTags = new Set(input.tags.map((t) => t.toLowerCase()));
  if (requestedTags.size === 0) return [];

  const scored = candidates
    .filter((p) => p.status === 1)
    .filter((p) => !input.category || p.category === input.category)
    .map((p) => {
      const matchCount = p.tags.filter((t) => requestedTags.has(t.toLowerCase())).length;
      return { product: p, matchCount };
    })
    .filter((s) => s.matchCount > 0);

  scored.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return b.product.createdAt.getTime() - a.product.createdAt.getTime();
  });

  return scored.slice(0, input.limit).map((s) => s.product);
}
