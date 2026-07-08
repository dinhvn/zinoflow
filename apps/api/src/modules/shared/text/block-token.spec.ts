import {
  findTokensMissingHeadingAbove,
  parseBlockTokens,
  resolveLimit,
} from "./block-token";

describe("parseBlockTokens (dichoithoi-article-spec.md §3)", () => {
  it("parse token hop le kem tham so", () => {
    const md = "## Thác đẹp\n\n[[block:destinations type=thac-ho-suoi limit=6 province=lam-dong]]\n";
    const tokens = parseBlockTokens(md);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      kind: "destinations",
      params: { type: "thac-ho-suoi", limit: "6", province: "lam-dong" },
    });
  });

  it("khong khop token nam giua doan van (khong RIENG 1 dong)", () => {
    const md = "Xem thêm [[block:destinations type=thac-ho-suoi]] ở đây.";
    expect(parseBlockTokens(md)).toHaveLength(0);
  });

  it("kind khong ton tai trong BLOCK_KINDS -> kind=null (loi cu phap, caller tu quyet dinh chan)", () => {
    const tokens = parseBlockTokens("[[block:unknown-thing foo=bar]]");
    expect(tokens[0]?.kind).toBeNull();
  });

  it("nhieu token tren nhieu dong deu duoc parse dung lineIndex", () => {
    const md = "dòng 0\n[[block:hotels province=lam-dong]]\ndòng 2\n[[block:tours limit=4]]";
    const tokens = parseBlockTokens(md);
    expect(tokens.map((t) => t.lineIndex)).toEqual([1, 3]);
  });
});

describe("resolveLimit", () => {
  it("mac dinh 8 khi khong co limit", () => {
    expect(resolveLimit({})).toBe(8);
  });
  it("gioi han toi da 12", () => {
    expect(resolveLimit({ limit: "50" })).toBe(12);
  });
  it("gia tri khong hop le -> mac dinh 8", () => {
    expect(resolveLimit({ limit: "abc" })).toBe(8);
    expect(resolveLimit({ limit: "-3" })).toBe(8);
  });
});

describe("findTokensMissingHeadingAbove (content-seo-ux-plan §8.3)", () => {
  it("khong bao loi khi co H2 ngay tren", () => {
    const md = "## Thác ở Lâm Đồng\n[[block:destinations type=thac-ho-suoi]]";
    expect(findTokensMissingHeadingAbove(md)).toHaveLength(0);
  });

  it("khong bao loi khi co H3 ngay tren, bo qua dong trong", () => {
    const md = "### Khu vực Đắk Nông\n\n\n[[block:destinations type=thac-ho-suoi]]";
    expect(findTokensMissingHeadingAbove(md)).toHaveLength(0);
  });

  it("bao loi khi dong tren la van xuoi thuong", () => {
    const md = "Đây là đoạn giới thiệu.\n[[block:destinations type=thac-ho-suoi]]";
    expect(findTokensMissingHeadingAbove(md)).toHaveLength(1);
  });

  it("bao loi khi token o dong dau tien (khong co gi phia tren)", () => {
    const md = "[[block:destinations type=thac-ho-suoi]]";
    expect(findTokensMissingHeadingAbove(md)).toHaveLength(1);
  });
});
