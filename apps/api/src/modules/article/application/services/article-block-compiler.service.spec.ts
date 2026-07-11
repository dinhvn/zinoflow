import { ArticleBlockCompiler } from "./article-block-compiler.service";
import type { DichoithoiSiteDb } from "../../../destination/application/ports/dichoithoi-site-db.port";
import type { HotelRepository } from "../../../hotel/application/ports/hotel.repository";
import type { TourRepository } from "../../../tour/application/ports/tour.repository";
import type { ProductRepository } from "../../../product/application/ports/product.repository";

function makeSiteDb(overrides: Partial<DichoithoiSiteDb> = {}): DichoithoiSiteDb {
  return {
    isConfigured: () => true,
    fetchAllDestinations: async () => [],
    fetchTypes: async () => [{ id: 1, slug: "thac-ho-suoi", name: "Sông - Suối - Hồ - Thác" }],
    fetchProvinceSlugs: async () => [{ slug: "lam-dong", code: "68", name: "Lâm Đồng" }],
    fetchDestinationContent: async () => null,
    publishDestination: async () => ({ contentHash: "x" }),
    fetchAllContentRows: async () => [],
    updateContentHtml: async () => {},
    addMentionedRelations: async () => {},
    fetchSlugRedirects: async () => new Map(),
    updateRelatedJson: async () => false,
    updateThumbnail: async () => {},
    createDestination: async () => ({ siteId: 1 }),
    updateMetadata: async () => {},
    updateTicketLinks: async () => {},
    findDestinationCards: async () => [
      { slug: "thac-datanla", name: "Thác Datanla", shortDescription: "Mô tả", thumbnail: "a.webp", kind: "poi" },
    ],
    findDestinationCardBySlug: async (slug) =>
      slug === "thac-datanla"
        ? { slug: "thac-datanla", name: "Thác Datanla", shortDescription: "Mô tả", thumbnail: "a.webp", kind: "poi" }
        : null,
    ...overrides,
  } as DichoithoiSiteDb;
}

function makeHotels(overrides: Partial<HotelRepository> = {}): HotelRepository {
  return {
    findAll: async () => [],
    findById: async () => null,
    create: async () => { throw new Error("unused"); },
    update: async () => { throw new Error("unused"); },
    setSiteId: async () => {},
    countDestinationsByHotel: async () => new Map(),
    assignToDestination: async () => {},
    unassignFromDestination: async () => {},
    listForDestination: async () => [],
    ...overrides,
  } as HotelRepository;
}

function makeTours(overrides: Partial<TourRepository> = {}): TourRepository {
  return {
    findAll: async () => [],
    findById: async () => null,
    create: async () => { throw new Error("unused"); },
    update: async () => { throw new Error("unused"); },
    setSiteId: async () => {},
    countDestinationsByTour: async () => new Map(),
    assignToDestination: async () => {},
    unassignFromDestination: async () => {},
    listForDestination: async () => [],
    ...overrides,
  } as TourRepository;
}

function makeProducts(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    findAll: async () => [],
    findById: async () => null,
    create: async () => { throw new Error("unused"); },
    update: async () => { throw new Error("unused"); },
    ...overrides,
  } as ProductRepository;
}

describe("ArticleBlockCompiler (dichoithoi-article-spec.md §4)", () => {
  it("compile token destinations hop le thanh card HTML, giu nguyen phan van xuoi", async () => {
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), makeProducts());
    const md = [
      "# Các thác đẹp",
      "",
      "Đoạn mở bài giới thiệu chung.",
      "",
      "## Thác ở Lâm Đồng",
      "",
      "[[block:destinations type=thac-ho-suoi province=lam-dong limit=6]]",
      "",
    ].join("\n");

    const result = await compiler.compile(md);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.blockCount).toBe(1);
    expect(result.html).toContain("Thác Datanla");
    expect(result.html).toContain("Đoạn mở bài giới thiệu chung");
    expect(result.html).not.toContain("[[block:");
  });

  it("token voi type khong ton tai -> error, chan publish", async () => {
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), makeProducts());
    const md = "## Mục\n\n[[block:destinations type=khong-ton-tai]]";
    const result = await compiler.compile(md);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("không tồn tại");
    expect(result.html).toBe("");
  });

  it("token hop le nhung 0 ket qua -> warning, khong render section rong", async () => {
    const siteDb = makeSiteDb({ findDestinationCards: async () => [] });
    const compiler = new ArticleBlockCompiler(siteDb, makeHotels(), makeTours(), makeProducts());
    const md = "## Mục rỗng\n\n[[block:destinations type=thac-ho-suoi]]\n\nVăn xuôi tiếp theo.";
    const result = await compiler.compile(md);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.html).not.toContain("block-card-grid");
    expect(result.html).toContain("Văn xuôi tiếp theo");
  });

  it("kind khong nhan dien (cu phap sai) -> error", async () => {
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), makeProducts());
    const result = await compiler.compile("[[block:unknown-thing]]");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("Cú pháp");
  });

  it("khoi destination (so it) 1 slug cu the render card don", async () => {
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), makeProducts());
    const result = await compiler.compile("[[block:destination slug=thac-datanla]]");
    expect(result.errors).toHaveLength(0);
    expect(result.html).toContain("Thác Datanla");
  });

  it("khoi products khop tag OR va render card kem gia (product-spec §4)", async () => {
    const products = makeProducts({
      findAll: async () => [
        {
          id: "p1",
          name: "Balo phượt 40L",
          category: "Balo",
          tags: ["phuot", "leo-nui"],
          thumbnailUrl: "balo.webp",
          thumbnailSourceUrl: null,
          price: 590000,
          provider: "shopee",
          sourceUrl: "https://shopee.vn/balo",
          affiliateUrl: "https://shopee.vn/balo?aff=1",
          linkStatus: "converted",
          source: 0,
          status: 1,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ],
    });
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), products);
    const result = await compiler.compile("## Chuẩn bị đồ\n\n[[block:products tag=phuot limit=4]]");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.html).toContain("Balo phượt 40L");
    expect(result.html).toContain("590.000đ");
  });

  it("khoi products thieu tham so tag -> error", async () => {
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), makeProducts());
    const result = await compiler.compile("[[block:products limit=4]]");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("tham số tag");
  });

  it("khoi food-spots khop tag VA loc dung category am thuc (article-spec §3.1)", async () => {
    const products = makeProducts({
      findAll: async () => [
        {
          id: "p1",
          name: "Quán Bánh Căn Dì Ba",
          category: "Đặc sản",
          tags: ["da-lat"],
          thumbnailUrl: "banh-can.webp",
          thumbnailSourceUrl: null,
          price: 30000,
          provider: null,
          sourceUrl: "https://maps.google.com/banh-can",
          affiliateUrl: null,
          linkStatus: "no-rule",
          source: 0,
          status: 1,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
        {
          id: "p2",
          name: "Balo phượt 40L",
          category: "Balo",
          tags: ["da-lat"],
          thumbnailUrl: "balo.webp",
          thumbnailSourceUrl: null,
          price: 590000,
          provider: "shopee",
          sourceUrl: "https://shopee.vn/balo",
          affiliateUrl: "https://shopee.vn/balo?aff=1",
          linkStatus: "converted",
          source: 0,
          status: 1,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ],
    });
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), products);
    const result = await compiler.compile("## Ăn gì ở Đà Lạt\n\n[[block:food-spots tag=da-lat]]");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.html).toContain("Quán Bánh Căn Dì Ba");
    expect(result.html).not.toContain("Balo phượt 40L");
  });

  it("khoi food-spots thieu tham so tag -> error", async () => {
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), makeProducts());
    const result = await compiler.compile("[[block:food-spots limit=4]]");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain("tham số tag");
  });

  it("khoi food-spots khong khop category am thuc nao -> warning, khong render", async () => {
    const products = makeProducts({
      findAll: async () => [
        {
          id: "p2",
          name: "Balo phượt 40L",
          category: "Balo",
          tags: ["da-lat"],
          thumbnailUrl: "balo.webp",
          thumbnailSourceUrl: null,
          price: 590000,
          provider: "shopee",
          sourceUrl: "https://shopee.vn/balo",
          affiliateUrl: "https://shopee.vn/balo?aff=1",
          linkStatus: "converted",
          source: 0,
          status: 1,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ],
    });
    const compiler = new ArticleBlockCompiler(makeSiteDb(), makeHotels(), makeTours(), products);
    const result = await compiler.compile("## Ăn gì\n\n[[block:food-spots tag=da-lat]]");
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });
});
