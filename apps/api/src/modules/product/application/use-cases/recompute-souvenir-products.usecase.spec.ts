import { RecomputeSouvenirProductsUseCase } from "./recompute-souvenir-products.usecase";
import type { ProductRecord, ProductRepository } from "../ports/product.repository";
import type { DestinationMirrorRepository } from "../../../destination/application/ports/destination-mirror.repository";
import type { DichoithoiSiteDb } from "../../../destination/application/ports/dichoithoi-site-db.port";

function fakeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "p1",
    name: "Mứt dâu Đà Lạt",
    category: "đặc sản",
    tags: ["da-lat"],
    thumbnailUrl: null,
    thumbnailSourceUrl: null,
    price: 50_000,
    provider: null,
    sourceUrl: "https://shopee.vn/a",
    affiliateUrl: null,
    linkStatus: "no-rule",
    source: 0,
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("RecomputeSouvenirProductsUseCase (Phase 27 — Quà mang về MVP)", () => {
  it("ghi card san pham khop tag=slug diem den", async () => {
    const products = {
      findAll: async () => [fakeProduct()],
      findById: async () => fakeProduct(),
    } as unknown as ProductRepository;
    const destinationRepo = {
      findBySlug: async () => ({ slug: "da-lat", siteId: 42 }),
      findAll: async () => [{ slug: "da-lat", siteId: 42 }],
    } as unknown as DestinationMirrorRepository;
    const updateSouvenirProducts = jest.fn();
    const siteDb = { updateSouvenirProducts } as unknown as DichoithoiSiteDb;

    const usecase = new RecomputeSouvenirProductsUseCase(products, destinationRepo, siteDb);
    await usecase.forDestination("da-lat");

    expect(updateSouvenirProducts).toHaveBeenCalledWith(
      42,
      JSON.stringify([
        {
          name: "Mứt dâu Đà Lạt",
          category: "đặc sản",
          price: 50_000,
          thumbnailUrl: null,
          href: "https://shopee.vn/a",
        },
      ]),
    );
  });

  it("bo qua diem den chua len web (siteId null)", async () => {
    const products = { findAll: async () => [] } as unknown as ProductRepository;
    const destinationRepo = {
      findBySlug: async () => ({ slug: "chua-publish", siteId: null }),
    } as unknown as DestinationMirrorRepository;
    const updateSouvenirProducts = jest.fn();
    const siteDb = { updateSouvenirProducts } as unknown as DichoithoiSiteDb;

    const usecase = new RecomputeSouvenirProductsUseCase(products, destinationRepo, siteDb);
    await usecase.forDestination("chua-publish");

    expect(updateSouvenirProducts).not.toHaveBeenCalled();
  });

  it("forProduct chi tinh lai cac diem den co that trong tags (bo qua tag khong phai slug)", async () => {
    const product = fakeProduct({ tags: ["da-lat", "khong-phai-slug"] });
    const products = {
      findAll: async () => [product],
      findById: async () => product,
    } as unknown as ProductRepository;
    const destinationRepo = {
      findBySlug: async (slug: string) => (slug === "da-lat" ? { slug, siteId: 42 } : null),
      findAll: async () => [{ slug: "da-lat", siteId: 42 }],
    } as unknown as DestinationMirrorRepository;
    const updateSouvenirProducts = jest.fn();
    const siteDb = { updateSouvenirProducts } as unknown as DichoithoiSiteDb;

    const usecase = new RecomputeSouvenirProductsUseCase(products, destinationRepo, siteDb);
    await usecase.forProduct("p1");

    expect(updateSouvenirProducts).toHaveBeenCalledTimes(1);
    expect(updateSouvenirProducts).toHaveBeenCalledWith(42, expect.any(String));
  });
});
