import { ImportProductsUseCase } from "./import-products.usecase";
import { UpsertProductUseCase } from "./upsert-product.usecase";
import type { ProductRecord, ProductRepository } from "../ports/product.repository";
import type { ImportProductsRequest } from "@zinoflow/contracts";

function fakeRecord(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "p1",
    name: "Balo phượt 40L",
    category: "Balo",
    tags: ["phuot"],
    thumbnailUrl: null,
    thumbnailSourceUrl: null,
    price: null,
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

describe("ImportProductsUseCase (product-spec §5.1 — chi UPSERT theo sourceUrl)", () => {
  function setup(existing: ProductRecord[]) {
    const created: string[] = [];
    const updated: string[] = [];
    const products: ProductRepository = {
      findAll: async () => existing,
      findById: async (id) => existing.find((e) => e.id === id) ?? null,
      create: async () => {
        created.push("x");
        return fakeRecord();
      },
      update: async () => {
        updated.push("x");
        return fakeRecord();
      },
    };
    const upsertProduct = {
      create: async (r: { sourceUrl: string }) => {
        created.push(r.sourceUrl);
        return {} as never;
      },
      update: async (id: string) => {
        updated.push(id);
        return {} as never;
      },
    } as unknown as UpsertProductUseCase;

    return { usecase: new ImportProductsUseCase(products, upsertProduct), created, updated };
  }

  function baseRequest(overrides: Partial<ImportProductsRequest> = {}): ImportProductsRequest {
    return { items: [], dryRun: true, ...overrides };
  }

  it("khop dung sourceUrl -> update, khac -> create (khong fallback ten)", async () => {
    const { usecase, created, updated } = setup([fakeRecord()]);

    const result = await usecase.execute(
      baseRequest({
        dryRun: false,
        items: [
          { name: "Balo phượt 40L (đổi tên)", sourceUrl: "https://shopee.vn/a" } as never,
          { name: "Balo phượt 40L", sourceUrl: "https://shopee.vn/b" } as never,
        ],
      }),
    );

    expect(updated).toEqual(["p1"]);
    // Trung ten HOAN TOAN nhung sourceUrl khac -> van la CREATE (khong fallback)
    expect(created).toEqual(["https://shopee.vn/b"]);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
  });

  it("dry-run khong ghi DB", async () => {
    const { usecase, created, updated } = setup([]);

    await usecase.execute(baseRequest({ items: [{ name: "X", sourceUrl: "https://shopee.vn/z" } as never] }));

    expect(created).toHaveLength(0);
    expect(updated).toHaveLength(0);
  });
});
