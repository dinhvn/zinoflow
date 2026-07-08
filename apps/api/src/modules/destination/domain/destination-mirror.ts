import type {
  ContentJobStatus,
  DestinationContentState,
  DestinationProductionState,
  DestinationSortBy,
} from "@zinoflow/contracts";
import type { DestinationSyncFlag } from "@zinoflow/contracts";

/**
 * Domain rules cho mirror diem den (spec dichoithoi-destination-spec §12.1).
 * Thuan TS — quyet dinh sync per-row va suy trang thai noi dung cho UI.
 */

/** 1 dong doc tu SQL Server (schema moi — redesign doc §4) */
export interface SiteDestinationRow {
  siteId: number;
  slug: string;
  kind: "province" | "cluster" | "poi";
  parentSlug: string | null;
  provinceCode: string | null;
  name: string;
  shortDescription: string | null;
  thumbnail: string | null;
  lat: number | null;
  lng: number | null;
  addressNew: string | null;
  addressOld: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  hotelGroupId: string | null;
  isFeatured: boolean;
  siteStatus: number;
  contentSource: number | null;
  contentHash: string | null;
  siteUpdatedAt: Date | null;
}

/** Trang thai mirror toi thieu de ra quyet dinh sync */
export interface MirrorSyncState {
  slug: string;
  contentHash: string | null;
  hasLocalChanges: boolean;
  /** AI tool co publish diem nay ke tu lan sync truoc khong */
  publishedSinceLastSync: boolean;
}

export type SyncAction =
  | { action: "insert" }
  | { action: "update"; flags: DestinationSyncFlag[] }
  | { action: "skip-conflict" };

/**
 * Quyet dinh xu ly 1 dong khi dong bo mirror (spec §12.1 buoc 2-3):
 * - chua co trong mirror -> insert.
 * - mirror co thay doi local chua publish -> KHONG de, danh dau conflict.
 * - contentHash doi ma AI tool khong publish -> edited-outside (sua tay tren DB,
 *   lan publish de tiep theo se xoa mat phan sua do — phai canh bao).
 */
export function decideSyncAction(
  siteRow: SiteDestinationRow,
  mirror: MirrorSyncState | undefined,
): SyncAction {
  if (!mirror) {
    return { action: "insert" };
  }
  if (mirror.hasLocalChanges) {
    return { action: "skip-conflict" };
  }
  const contentChangedOutside =
    mirror.contentHash !== null &&
    siteRow.contentHash !== null &&
    mirror.contentHash !== siteRow.contentHash &&
    !mirror.publishedSinceLastSync;
  return {
    action: "update",
    flags: contentChangedOutside ? ["edited-outside"] : [],
  };
}

/**
 * Suy trang thai noi dung cho UI (spec §7.2 — cot quan trong nhat):
 * dang co job chay > da publish boi AI > co bai viet tay > chua co bai.
 * activeJobStatus = Approved -> tach rieng "da-duyet" (da duyet nhung chua publish);
 * cac status con lai coi la "dang-soan". Job Rejected da duoc caller clear con tro
 * truoc do nen o day khong xuat hien.
 */
export function deriveContentState(input: {
  activeContentJobId: string | null;
  activeJobStatus: ContentJobStatus | null;
  contentSource: number | null;
  contentHash: string | null;
}): DestinationContentState {
  if (input.activeContentJobId) {
    return input.activeJobStatus === "Approved" ? "da-duyet" : "dang-soan";
  }
  if (input.contentSource === 1) return "da-publish";
  if (input.contentHash) return "bai-tay";
  return "chua-co-bai";
}

/**
 * Suy tinh trang production tu siteId + Status ben SQL Server (0 draft,1 published,2 hidden):
 * chua co siteId = chua len web; con lai map thang theo Status.
 */
export function deriveProductionState(
  siteId: number | null,
  siteStatus: number | null,
): DestinationProductionState {
  if (siteId === null) return "not-live";
  if (siteStatus === 1) return "online";
  if (siteStatus === 2) return "hidden";
  if (siteStatus === 0) return "draft";
  // Da co siteId nhung chua biet Status (chua sync lai) -> coi nhu chua chac len
  return "not-live";
}

/**
 * Anh da theo convention MOI chua? (spec §14.1.3 — folder theo slug)
 * Moi = "{slug}/{slug}-thumb.webp" (co "/"); cu = ten file phang "{slug}.webp" hoac null.
 * Dung de job migrate anh bo qua diem da chuyen (idempotent).
 */
export function isNewImagePath(thumbnail: string | null): boolean {
  return thumbnail !== null && thumbnail.includes("/");
}

/** Du lieu toi thieu de sort 1 dong tren man danh sach */
export interface DestinationSortRow {
  name: string;
  provinceName: string | null;
  kind: "province" | "cluster" | "poi";
  contentState: DestinationContentState;
}

// Rank de sort kind/contentState theo thu tu CO NGHIA (khong phai alphabet)
const KIND_RANK: Record<DestinationSortRow["kind"], number> = {
  province: 0,
  cluster: 1,
  poi: 2,
};
const CONTENT_STATE_RANK: Record<DestinationContentState, number> = {
  "chua-co-bai": 0,
  "bai-tay": 1,
  "dang-soan": 2,
  "da-duyet": 3,
  "da-publish": 4,
};

/**
 * Comparator sort cho danh sach diem den (server-side). name/province so chuoi
 * (locale vi), kind/contentState so theo rank co nghia. dir "desc" dao dau.
 */
export function compareDestinationsForSort(
  sortBy: DestinationSortBy,
  sortDir: "asc" | "desc",
): (a: DestinationSortRow, b: DestinationSortRow) => number {
  const factor = sortDir === "desc" ? -1 : 1;
  return (a, b) => {
    let cmp: number;
    switch (sortBy) {
      case "name":
        cmp = a.name.localeCompare(b.name, "vi");
        break;
      case "province":
        // Diem chua gan tinh (null) xuong cuoi khi asc
        cmp = (a.provinceName ?? "￿").localeCompare(b.provinceName ?? "￿", "vi");
        break;
      case "kind":
        cmp = KIND_RANK[a.kind] - KIND_RANK[b.kind];
        break;
      case "contentState":
        cmp = CONTENT_STATE_RANK[a.contentState] - CONTENT_STATE_RANK[b.contentState];
        break;
    }
    // Tie-break theo ten de thu tu on dinh
    if (cmp === 0 && sortBy !== "name") cmp = a.name.localeCompare(b.name, "vi");
    return cmp * factor;
  };
}
