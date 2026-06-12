import { decideSyncAction, deriveContentState, type SiteDestinationRow } from "./destination-mirror";

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
    bookingUrl: null,
    hotelGroupId: null,
    isFeatured: false,
    siteStatus: 1,
    contentSource: 0,
    contentHash: "hash-a",
    siteUpdatedAt: null,
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
  it("dang-soan khi co job dang chay (uu tien cao nhat)", () => {
    expect(
      deriveContentState({ activeContentJobId: "job-1", contentSource: 1, contentHash: "h" }),
    ).toBe("dang-soan");
  });

  it("da-publish khi contentSource = 1 (AI tool)", () => {
    expect(
      deriveContentState({ activeContentJobId: null, contentSource: 1, contentHash: "h" }),
    ).toBe("da-publish");
  });

  it("bai-tay khi co content nhung khong phai tu AI tool", () => {
    expect(
      deriveContentState({ activeContentJobId: null, contentSource: 0, contentHash: "h" }),
    ).toBe("bai-tay");
  });

  it("chua-co-bai khi khong co content", () => {
    expect(
      deriveContentState({ activeContentJobId: null, contentSource: null, contentHash: null }),
    ).toBe("chua-co-bai");
  });
});
