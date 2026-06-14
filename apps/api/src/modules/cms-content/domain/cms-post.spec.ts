import {
  CMS_TAG_PLACEHOLDER,
  compareCmsPostsForSort,
  deriveCmsContentState,
  extractCmsTags,
  hasUnfilledTagPlaceholder,
  type CmsPostSortFields,
} from "./cms-post";

describe("hasUnfilledTagPlaceholder", () => {
  it("phat hien placeholder CAN_DIEN_MA trong content", () => {
    expect(hasUnfilledTagPlaceholder(`[ProductList_ProductTag:${CMS_TAG_PLACEHOLDER};NumberProduct:5]`)).toBe(true);
  });
  it("phat hien o bat ky doan nao (title)", () => {
    expect(hasUnfilledTagPlaceholder("<p>html</p>", `Tiêu đề ${CMS_TAG_PLACEHOLDER}`)).toBe(true);
  });
  it("false khi tag da dien ma that", () => {
    expect(hasUnfilledTagPlaceholder("[ProductList_ProductTag:lap-rap-co-khi]", "Tiêu đề sạch")).toBe(false);
  });
  it("bo qua null/undefined", () => {
    expect(hasUnfilledTagPlaceholder(null, undefined, "")).toBe(false);
  });
});

describe("deriveCmsContentState", () => {
  const base = { activeContentJobId: null, aiContentWrittenAt: null, datePublished: null };

  it("dang-soan khi co job", () => {
    expect(deriveCmsContentState({ ...base, activeContentJobId: "j1" })).toBe("dang-soan");
  });
  it("chua-co-bai khi chua ghi AI", () => {
    expect(deriveCmsContentState(base)).toBe("chua-co-bai");
  });
  it("da-ghi-cms khi da ghi nhung chua publish lai", () => {
    const written = new Date("2026-06-10");
    expect(deriveCmsContentState({ ...base, aiContentWrittenAt: written, datePublished: new Date("2026-06-01") })).toBe(
      "da-ghi-cms",
    );
  });
  it("da-publish khi publish SAU khi ghi", () => {
    const written = new Date("2026-06-01");
    expect(deriveCmsContentState({ ...base, aiContentWrittenAt: written, datePublished: new Date("2026-06-10") })).toBe(
      "da-publish",
    );
  });
});

describe("extractCmsTags", () => {
  it("boc cac tag [..] khong trung lap", () => {
    const c = "<p>Xem [ProductList_SupplierCode:juno] và [Year], lại [ProductList_SupplierCode:juno]</p>";
    expect(extractCmsTags(c)).toEqual(["[ProductList_SupplierCode:juno]", "[Year]"]);
  });
  it("rong khi null/khong co tag", () => {
    expect(extractCmsTags(null)).toEqual([]);
    expect(extractCmsTags("khong co tag")).toEqual([]);
  });
});

describe("compareCmsPostsForSort", () => {
  const row = (o: Partial<CmsPostSortFields>): CmsPostSortFields => ({
    title: "A",
    postType: null,
    contentState: "chua-co-bai",
    dateUpdated: null,
    ...o,
  });
  const sorted = (rows: CmsPostSortFields[], by: Parameters<typeof compareCmsPostsForSort>[0], dir: "asc" | "desc") =>
    [...rows].sort(compareCmsPostsForSort(by, dir)).map((r) => r.title);

  it("sort theo title locale vi", () => {
    const rows = [row({ title: "Ô" }), row({ title: "Ấn" }), row({ title: "Ba" })];
    expect(sorted(rows, "title", "asc")).toEqual(["Ấn", "Ba", "Ô"]);
  });
  it("sort theo dateUpdated desc (moi nhat truoc)", () => {
    const rows = [
      row({ title: "cu", dateUpdated: new Date("2024-01-01") }),
      row({ title: "moi", dateUpdated: new Date("2026-01-01") }),
    ];
    expect(sorted(rows, "dateUpdated", "desc")).toEqual(["moi", "cu"]);
  });
});
