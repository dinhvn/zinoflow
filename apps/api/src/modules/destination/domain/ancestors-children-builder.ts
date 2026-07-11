import type { RelatedCandidate } from "./related-builder";

/**
 * Builder khoi AncestorsJson/ChildrenJson (database-redesign §3.4) — breadcrumb
 * + danh sach con precompute, tach rieng RelatedJson vi muc dich khac nhau:
 * RelatedJson goi y (cat 8, tron nhieu nguon), Ancestors/Children liet ke DAY
 * DU cay cau truc that (khong cat, khong tron nguon). Pure TS + unit tests.
 */

/** 1 muc trong AncestorsJson — tu goc den cha truc tiep, KHONG gom chinh no */
export interface AncestorRef {
  slug: string;
  name: string;
  kind: RelatedCandidate["kind"];
}

/** 1 muc trong ChildrenJson — danh sach DAY DU con truc tiep da publish */
export interface ChildRef {
  slug: string;
  name: string;
  thumbnail: string | null;
  kind: RelatedCandidate["kind"];
  /** Phase 28.2 — 2 lop Diem tham quan trang Flagship (content-seo-ux-plan §10.6.2 khoi 5) */
  isFeatured: boolean;
  order: number;
  distanceFromCenter: number | null;
}

/**
 * Di tu parentSlug len goc, tra ve mang [goc, ..., cha truc tiep] (thu tu
 * breadcrumb tu trai qua phai). Bao ve vong lap (du lieu loi parentSlug
 * tro thanh chu trinh) bang tap visited — dung ngay khi gap slug da di qua.
 */
export function buildAncestors(
  self: RelatedCandidate,
  all: readonly RelatedCandidate[],
): AncestorRef[] {
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const chain: AncestorRef[] = [];
  const visited = new Set<string>([self.slug]);

  let currentSlug = self.parentSlug;
  while (currentSlug) {
    if (visited.has(currentSlug)) break;
    const node = bySlug.get(currentSlug);
    if (!node) break;
    visited.add(node.slug);
    chain.unshift({ slug: node.slug, name: node.name, kind: node.kind });
    currentSlug = node.parentSlug;
  }
  return chain;
}

/**
 * Toan bo con truc tiep DA PUBLISH cua self (khong cat so luong nhu RelatedJson),
 * sap xep theo ten (vi) de hien thi on dinh tren trang tinh/cum.
 */
export function buildChildren(
  self: RelatedCandidate,
  all: readonly RelatedCandidate[],
): ChildRef[] {
  return all
    .filter((c) => c.parentSlug === self.slug && c.siteStatus === 1)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      thumbnail: c.thumbnail,
      kind: c.kind,
      isFeatured: c.isFeatured,
      order: c.order,
      distanceFromCenter: c.distanceFromCenter,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
