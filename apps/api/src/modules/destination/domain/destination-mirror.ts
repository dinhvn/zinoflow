import type {
  DestinationContentState,
  DestinationSyncFlag,
} from "@zinoflow/contracts";

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
  bookingUrl: string | null;
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
 */
export function deriveContentState(input: {
  activeContentJobId: string | null;
  contentSource: number | null;
  contentHash: string | null;
}): DestinationContentState {
  if (input.activeContentJobId) return "dang-soan";
  if (input.contentSource === 1) return "da-publish";
  if (input.contentHash) return "bai-tay";
  return "chua-co-bai";
}
