import {
  compareDestinationsForSort,
  decideSyncAction,
  deriveContentState,
  deriveProductionState,
  isNewImagePath,
  type DestinationSortRow,
  type SiteDestinationRow,
} from "./destination-mirror";

function siteRow(overrides: Partial<SiteDestinationRow> = {}): SiteDestinationRow {
  return {
    siteId: 1,
    slug: "vinh-ha-long",
    kind: "poi",
    parentSlug: null,
    provinceCode: "22",
    name: "Vịnh Hạ Long",
    shortDescription: null,
    thumbnail: null,
    lat: null,
    lng: null,
    addressNew: null,
    addressOld: null,
    contactPhone: null,
    contactWebsite: null,
    hotelGroupId: null,
    isFeatured: false,
    contentTier: null,
    order: 0,
    distanceFromCenter: null,
    siteStatus: 1,
    contentSource: 0,
    contentHash: "hash-a",
    siteUpdatedAt: null,
    ticketPrice: null,
    ...overrides,
  };
}

describe("decideSyncAction (spec §12.1)", () => {
  it("inserts when destination chua co trong mirror", () => {
    expect(decideSyncAction(siteRow(), undefined)).toEqual({ action: "insert" });
  });

  it("skips with conflict when mirror co local changes chua publish", () => {
    const action = decideSyncAction(siteRow(), {
      slug: "vinh-ha-long",
      contentHash: "hash-a",
      hasLocalChanges: true,
      publishedSinceLastSync: false,
    });
    expect(action).toEqual({ action: "skip-conflict" });
  });

  it("flags edited-outside when content hash doi ma AI tool khong publish", () => {
    const action = decideSyncAction(siteRow({ contentHash: "hash-B" }), {
      slug: "vinh-ha-long",
      contentHash: "hash-a",
      hasLocalChanges: false,
      publishedSinceLastSync: false,
    });
    expect(action).toEqual({ action: "update", flags: ["edited-outside"] });
  });

  it("khong flag khi hash doi do chinh AI tool publish", () => {
    const action = decideSyncAction(siteRow({ contentHash: "hash-B" }), {
      slug: "vinh-ha-long",
      contentHash: "hash-a",
      hasLocalChanges: false,
      publishedSinceLastSync: true,
    });
    expect(action).toEqual({ action: "update", flags: [] });
  });

  it("update binh thuong khi hash khong doi", () => {
    const action = decideSyncAction(siteRow(), {
      slug: "vinh-ha-long",
      contentHash: "hash-a",
      hasLocalChanges: false,
      publishedSinceLastSync: false,
    });
    expect(action).toEqual({ action: "update", flags: [] });
  });
});

describe("deriveContentState (spec §7.2)", () => {
  it("dang-soan khi co job dang chay chua duyet (uu tien cao nhat)", () => {
    expect(
      deriveContentState({
        activeContentJobId: "job-1",
        activeJobStatus: "GeneratingOutline",
        contentSource: 1,
        contentHash: "h",
      }),
    ).toBe("dang-soan");
  });

  it("da-duyet khi job da Approved nhung chua publish", () => {
    expect(
      deriveContentState({
        activeContentJobId: "job-1",
        activeJobStatus: "Approved",
        contentSource: null,
        contentHash: null,
      }),
    ).toBe("da-duyet");
  });

  it("da-publish khi contentSource = 1 (AI tool) va khong con job", () => {
    expect(
      deriveContentState({
        activeContentJobId: null,
        activeJobStatus: null,
        contentSource: 1,
        contentHash: "h",
      }),
    ).toBe("da-publish");
  });

  it("bai-tay khi co content nhung khong phai tu AI tool", () => {
    expect(
      deriveContentState({
        activeContentJobId: null,
        activeJobStatus: null,
        contentSource: 0,
        contentHash: "h",
      }),
    ).toBe("bai-tay");
  });

  it("chua-co-bai khi khong co content", () => {
    expect(
      deriveContentState({
        activeContentJobId: null,
        activeJobStatus: null,
        contentSource: null,
        contentHash: null,
      }),
    ).toBe("chua-co-bai");
  });
});

describe("deriveProductionState", () => {
  it("not-live khi chua co siteId (chi song trong AI tool)", () => {
    expect(deriveProductionState(null, null)).toBe("not-live");
  });

  it("online khi Status=1", () => {
    expect(deriveProductionState(42, 1)).toBe("online");
  });

  it("hidden khi Status=2 (co URL nhung an)", () => {
    expect(deriveProductionState(42, 2)).toBe("hidden");
  });

  it("draft khi Status=0", () => {
    expect(deriveProductionState(42, 0)).toBe("draft");
  });
});

describe("isNewImagePath (migrate anh §14.1.3)", () => {
  it("true khi path theo folder-slug moi", () => {
    expect(isNewImagePath("nui-ham-rong/thumb.webp")).toBe(true);
  });

  it("false khi ten file phang layout cu", () => {
    expect(isNewImagePath("nui-ham-rong.webp")).toBe(false);
  });

  it("false khi chua co anh", () => {
    expect(isNewImagePath(null)).toBe(false);
  });
});

describe("compareDestinationsForSort", () => {
  const row = (over: Partial<DestinationSortRow>): DestinationSortRow => ({
    name: "A",
    provinceName: null,
    kind: "poi",
    contentState: "chua-co-bai",
    ...over,
  });

  function sorted(rows: DestinationSortRow[], by: Parameters<typeof compareDestinationsForSort>[0], dir: "asc" | "desc") {
    return [...rows].sort(compareDestinationsForSort(by, dir)).map((r) => r.name);
  }

  it("sort theo ten (locale vi) asc/desc", () => {
    const rows = [row({ name: "Ô Quan Chưởng" }), row({ name: "Ấn Độ" }), row({ name: "Ba Vì" })];
    expect(sorted(rows, "name", "asc")).toEqual(["Ấn Độ", "Ba Vì", "Ô Quan Chưởng"]);
    expect(sorted(rows, "name", "desc")).toEqual(["Ô Quan Chưởng", "Ba Vì", "Ấn Độ"]);
  });

  it("sort theo kind theo rank province->cluster->poi", () => {
    const rows = [
      row({ name: "p", kind: "poi" }),
      row({ name: "t", kind: "province" }),
      row({ name: "c", kind: "cluster" }),
    ];
    expect(sorted(rows, "kind", "asc")).toEqual(["t", "c", "p"]);
  });

  it("sort theo contentState theo rank, tie-break theo ten", () => {
    const rows = [
      row({ name: "B", contentState: "da-publish" }),
      row({ name: "A", contentState: "da-publish" }),
      row({ name: "C", contentState: "chua-co-bai" }),
    ];
    expect(sorted(rows, "contentState", "asc")).toEqual(["C", "A", "B"]);
  });

  it("sort theo province dua diem khong co tinh (null) xuong cuoi khi asc", () => {
    const rows = [
      row({ name: "x", provinceName: null }),
      row({ name: "y", provinceName: "Hà Nội" }),
      row({ name: "z", provinceName: "Đà Nẵng" }),
    ];
    expect(sorted(rows, "province", "asc")).toEqual(["z", "y", "x"]);
  });
});
