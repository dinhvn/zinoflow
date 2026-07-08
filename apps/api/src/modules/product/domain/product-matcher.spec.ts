import { matchProducts, type ProductCandidate } from "./product-matcher";

function product(overrides: Partial<ProductCandidate> & { id: string }): ProductCandidate {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    category: overrides.category ?? "balo",
    tags: overrides.tags ?? [],
    status: overrides.status ?? 1,
    createdAt: overrides.createdAt ?? new Date("2026-01-01"),
  };
}

describe("matchProducts", () => {
  it("khop OR — chi can trung 1 tag la du", () => {
    const a = product({ id: "a", tags: ["phuot"] });
    const b = product({ id: "b", tags: ["leo-nui"] });
    const c = product({ id: "c", tags: ["di-bien"] });
    const result = matchProducts([a, b, c], { tags: ["phuot", "leo-nui"], limit: 8 });
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("sap xep so tag khop nhieu hon len truoc", () => {
    const oneTag = product({ id: "one", tags: ["phuot"], createdAt: new Date("2026-02-01") });
    const twoTags = product({
      id: "two",
      tags: ["phuot", "leo-nui"],
      createdAt: new Date("2026-01-01"),
    });
    const result = matchProducts([oneTag, twoTags], { tags: ["phuot", "leo-nui"], limit: 8 });
    expect(result.map((p) => p.id)).toEqual(["two", "one"]);
  });

  it("cung so tag khop thi moi nhat truoc", () => {
    const older = product({ id: "older", tags: ["phuot"], createdAt: new Date("2026-01-01") });
    const newer = product({ id: "newer", tags: ["phuot"], createdAt: new Date("2026-03-01") });
    const result = matchProducts([older, newer], { tags: ["phuot"], limit: 8 });
    expect(result.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("loc them theo category khi co chi dinh", () => {
    const balo = product({ id: "balo", category: "balo", tags: ["phuot"] });
    const giay = product({ id: "giay", category: "giay-di-bo", tags: ["phuot"] });
    const result = matchProducts([balo, giay], { tags: ["phuot"], category: "balo", limit: 8 });
    expect(result.map((p) => p.id)).toEqual(["balo"]);
  });

  it("bo qua san pham chua published (status != 1)", () => {
    const hidden = product({ id: "hidden", tags: ["phuot"], status: 0 });
    const result = matchProducts([hidden], { tags: ["phuot"], limit: 8 });
    expect(result).toEqual([]);
  });

  it("cat dung limit", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      product({ id: `p${i}`, tags: ["phuot"], createdAt: new Date(2026, 0, i + 1) }),
    );
    const result = matchProducts(many, { tags: ["phuot"], limit: 4 });
    expect(result).toHaveLength(4);
  });

  it("tra ve rong khi khong co tag nao yeu cau", () => {
    const a = product({ id: "a", tags: ["phuot"] });
    expect(matchProducts([a], { tags: [], limit: 8 })).toEqual([]);
  });
});
