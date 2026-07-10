import type { CoverageChecklistItem } from "@zinoflow/contracts";

/**
 * Content Coverage Score — destination-spec §2.2.2. Thuan TS, khong AI/DB —
 * chi tinh tu cac co da co san. Xem ghi chu pham vi trong
 * packages/contracts/src/dichoithoi/coverage-score.ts (2 muc Flagship spec
 * yeu cau nhung chua tinh duoc do thieu ha tang: lich trinh B, do phu bai
 * cam nang theo topic).
 */
export interface CoverageInput {
  kind: "province" | "cluster" | "poi";
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
  /** Chi co y nghia voi tier "flagship" — it nhat 1 diem con IsFeatured */
  hasFeaturedChild: boolean;
}

export interface CoverageScoreResult {
  tier: "poi" | "flagship";
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
];

export function computeCoverageScore(input: CoverageInput): CoverageScoreResult {
  const tier: "poi" | "flagship" = input.kind === "poi" ? "poi" : "flagship";
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
