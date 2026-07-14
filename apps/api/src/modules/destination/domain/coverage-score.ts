import type { CoverageChecklistItem } from "@zinoflow/contracts";

/**
 * Content Coverage Score — destination-spec §2.2.2. Thuan TS, khong AI/DB —
 * chi tinh tu cac co da co san. Phase 28.6: tier dung ContentTier THAT (Phase
 * 25) thay proxy qua kind; 3 muc Flagship-only truoc day ghi "chua tinh duoc
 * do thieu ha tang" nay da co du: do phu bai cam nang theo topic
 * (ArticleDestinationMap, Phase 26), danh gia bien tap + external review
 * (Phase 28.0). "Lich trinh goi y" (07/2026) khong con la muc rieng — da
 * chuyen thanh blockKey "lich-trinh" trong sections[], tinh chung vao
 * "main-content" nhu moi khoi khac thay vi tach doi hoi 1 field JSON rieng.
 */
export interface CoverageInput {
  kind: "province" | "cluster" | "poi";
  /** flagship | standard | null — chi y nghia voi kind IN (province, cluster) */
  contentTier: "flagship" | "standard" | null;
  hasAddress: boolean;
  hasCoordinates: boolean;
  hasThumbnail: boolean;
  hasMainContent: boolean;
  hasOpeningTime: boolean;
  hasTicketPrice: boolean;
  hasFaq: boolean;
  hasPracticalNotes: boolean;
  hasTicketLinks: boolean;
  hasTag: boolean;
  /** 3 muc sau CHI co y nghia voi tier "flagship" (Phase 28.6) */
  hasFeaturedChild: boolean;
  hasArticleTopicCoverage: boolean;
  hasEditorialReview: boolean;
  hasExternalReviewUrl: boolean;
}

export interface CoverageScoreResult {
  tier: "poi" | "standard" | "flagship";
  scorePercent: number;
  items: CoverageChecklistItem[];
}

const BASE_ITEMS: Array<{ key: string; label: string; check: (i: CoverageInput) => boolean }> = [
  { key: "address", label: "Địa chỉ (mới hoặc cũ)", check: (i) => i.hasAddress },
  { key: "coordinates", label: "Toạ độ (lat/lng)", check: (i) => i.hasCoordinates },
  { key: "thumbnail", label: "Ảnh đại diện", check: (i) => i.hasThumbnail },
  { key: "main-content", label: "Nội dung chính", check: (i) => i.hasMainContent },
  { key: "opening-time", label: "Giờ mở cửa", check: (i) => i.hasOpeningTime },
  { key: "ticket-price", label: "Giá vé", check: (i) => i.hasTicketPrice },
  { key: "faq", label: "FAQ", check: (i) => i.hasFaq },
  { key: "practical-notes", label: "Mẹo thực tế", check: (i) => i.hasPracticalNotes },
  { key: "ticket-links", label: "Link vé mua online", check: (i) => i.hasTicketLinks },
  { key: "tag", label: "Chủ đề (tag)", check: (i) => i.hasTag },
];

const FLAGSHIP_EXTRA_ITEMS: Array<{ key: string; label: string; check: (i: CoverageInput) => boolean }> = [
  { key: "featured-child", label: "Có điểm tham quan con nổi bật", check: (i) => i.hasFeaturedChild },
  {
    key: "article-topic-coverage",
    label: "Có bài cẩm nang gắn theo topic",
    check: (i) => i.hasArticleTopicCoverage,
  },
  { key: "editorial-review", label: "Đánh giá của biên tập viên", check: (i) => i.hasEditorialReview },
  { key: "external-review-url", label: "Link đánh giá ngoài (Maps/TripAdvisor)", check: (i) => i.hasExternalReviewUrl },
];

export function computeCoverageScore(input: CoverageInput): CoverageScoreResult {
  const tier: "poi" | "standard" | "flagship" =
    input.kind === "poi" ? "poi" : input.contentTier === "flagship" ? "flagship" : "standard";
  const definitions = tier === "flagship" ? [...BASE_ITEMS, ...FLAGSHIP_EXTRA_ITEMS] : BASE_ITEMS;
  const items: CoverageChecklistItem[] = definitions.map((d) => ({
    key: d.key,
    label: d.label,
    done: d.check(input),
  }));
  const doneCount = items.filter((i) => i.done).length;
  const scorePercent = Math.round((doneCount / items.length) * 100);
  return { tier, scorePercent, items };
}
