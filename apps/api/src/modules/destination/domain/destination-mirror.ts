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
  googleMapsUrl: string | null;
  addressNew: string | null;
  addressOld: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  hotelGroupId: string | null;
  priority: number;
  contentTier: "flagship" | "standard" | null;
  /** Thu tu hien thi thu cong (Phase 28.2) */
  order: number;
  /** Khoang cach toi trung tam cum/tinh cha, don vi MET (Phase 28.2) */
  distanceFromCenter: number | null;
  siteStatus: number;
  contentSource: number | null;
  contentHash: string | null;
  siteUpdatedAt: Date | null;
  /** Gia ve tai quay, van ban tu do — mirror 1 chieu tu TicketPrice (Phase 4) */
  ticketPrice: string | null;
  /** Slug cac loai hinh da gan (v2.DestinationTypeMap, nhieu-nhieu) — chi co y nghia
   * voi kind=poi (province/cluster luon rong). Mirror tu Giai doan B tro di, dung cho
   * thuat toan cham diem quan he (relations-plan §1.3, §1.4 muc 1). */
  types: string[];
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

/** "Miễn phí" phổ biến trong TicketPrice text (spec ticket-analysis §2) */
const FREE_TICKET_PRICE_RE = /miễn phí|mien phi|free/i;

/** Co gia ve THAT (khac "Miễn phí"/rong) — dung cho filter/uu tien trang /ve (doc §11.3) */
export function hasRealTicketPrice(ticketPrice: string | null): boolean {
  return ticketPrice !== null && ticketPrice.trim() !== "" && !FREE_TICKET_PRICE_RE.test(ticketPrice);
}

/**
 * "Co gia nhung chua co link mua online" — nhom uu tien tren trang /ve vi dang
 * bo lo hoa hong (doc §11.3). false neu diem mien phi/chua ro gia, hoac da co link.
 */
export function isPendingTicketOpportunity(
  ticketPrice: string | null,
  ticketLinksCount: number,
): boolean {
  return hasRealTicketPrice(ticketPrice) && ticketLinksCount === 0;
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

/**
 * Nhan tieng Viet cho AI biet dang viet cho TINH/CUM/POI de chon dung tam lich
 * trinh + cach di chuyen (tinh: 2 chieu tu thanh pho lon; cum: tu trung tam toi
 * cum + giua cac diem con) — dung CHUNG giua CreateDestinationJobUseCase (sinh
 * ca bai) va GenerateDestinationBlockUseCase (sinh rieng 1 khoi). Truoc day dinh
 * nghia rieng o create-destination-job.usecase.ts, roi them vao (commit f2bed13,
 * 23/07/2026) nhung sibling generate-destination-block khong duoc cap nhat theo —
 * chuyen ve domain layer dung chung de tranh drift lan nua.
 */
export const KIND_LABELS: Record<string, string> = {
  province: "Tỉnh/thành phố — bài tổng quan cả tỉnh, gồm nhiều điểm tham quan con",
  cluster:
    "Cụm du lịch — khu vực gồm nhiều điểm tham quan con gần nhau trong cùng tỉnh/thành",
  poi: "Điểm tham quan đơn lẻ",
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
