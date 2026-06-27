import {
  splitProductsIntoImages,
  countImages,
  resolveImageFit,
  resolveGrid,
  formatPriceVnd,
  formatDiscountPercent,
  computeDiscountPercent,
  DEFAULT_IMAGE_FIT,
  type ProductCell,
} from "@zinoflow/contracts";

/**
 * Unit test cho domain thuan cua image tool — spec §17.
 * Logic song o packages/contracts (dung chung web + worker); test chay bang jest cua api.
 */

function cell(id: string, override: ProductCell["imageFitOverride"] = null): ProductCell {
  return {
    id,
    name: `SP ${id}`,
    imageUrl: `https://cdn/${id}.jpg`,
    originalPrice: null,
    salePrice: null,
    discountPercent: null,
    badges: [],
    imageFitOverride: override,
  };
}

describe("splitProductsIntoImages", () => {
  it("chia 12 san pham, 4/anh -> 3 anh moi anh 4 SP", () => {
    const products = Array.from({ length: 12 }, (_, i) => cell(String(i)));
    const chunks = splitProductsIntoImages(products, 4);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.length === 4)).toBe(true);
  });

  it("anh cuoi thieu o khi N khong chia het k", () => {
    const products = Array.from({ length: 10 }, (_, i) => cell(String(i)));
    const chunks = splitProductsIntoImages(products, 4);
    expect(chunks.map((c) => c.length)).toEqual([4, 4, 2]);
  });

  it("countImages khop voi so chunk", () => {
    expect(countImages(12, 4)).toBe(3);
    expect(countImages(10, 4)).toBe(3);
    expect(countImages(1, 4)).toBe(1);
  });
});

describe("resolveImageFit", () => {
  it("dung global khi khong co override", () => {
    expect(resolveImageFit(cell("a"), DEFAULT_IMAGE_FIT)).toEqual(DEFAULT_IMAGE_FIT);
  });

  it("uu tien override rieng o", () => {
    const override = { scale: 2, offsetX: 0, offsetY: -0.5 };
    expect(resolveImageFit(cell("a", override), DEFAULT_IMAGE_FIT)).toEqual(override);
  });
});

describe("resolveGrid", () => {
  it("12 -> 3x4 theo preset mac dinh", () => {
    expect(resolveGrid(12, "square")).toEqual({ rows: 3, cols: 4 });
  });

  it("uu tien grid rules cua template", () => {
    const template = { gridRules: { landscape: { "12": { rows: 2, cols: 6 } } } } as any;
    expect(resolveGrid(12, "landscape", template)).toEqual({ rows: 2, cols: 6 });
  });

  it("fallback gan vuong khi khong co preset (vd 7)", () => {
    expect(resolveGrid(7, "square")).toEqual({ rows: 3, cols: 3 });
  });
});

describe("format gia", () => {
  it("format VND co dau cham + đ", () => {
    expect(formatPriceVnd(1250000)).toBe("1.250.000đ");
    expect(formatPriceVnd(0)).toBe("");
    expect(formatPriceVnd(null)).toBe("");
  });

  it("badge % giam", () => {
    expect(formatDiscountPercent(30)).toBe("-30%");
    expect(formatDiscountPercent(0)).toBe("");
  });

  it("tinh % giam tu gia goc/ban", () => {
    expect(computeDiscountPercent(100000, 70000)).toBe(30);
    expect(computeDiscountPercent(100000, 100000)).toBeNull();
    expect(computeDiscountPercent(null, 70000)).toBeNull();
  });
});
