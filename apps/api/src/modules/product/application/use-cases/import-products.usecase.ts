import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ImportProductsRequest, ImportProductsResult } from "@zinoflow/contracts";
import { PRODUCT_REPOSITORY, type ProductRepository } from "../ports/product.repository";
import { UpsertProductUseCase } from "./upsert-product.usecase";

/**
 * Import hang loat san pham tu Google Sheet (product-spec §5.1) — CHI UPSERT
 * theo `sourceUrl` (khong co khoa phu ten+tinh nhu Hotel/Tour, vi san pham
 * khong gan dia ly, trung ten khong du chac chan de tu goi y gop).
 */
@Injectable()
export class ImportProductsUseCase {
  private readonly logger = new Logger(ImportProductsUseCase.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    private readonly upsertProduct: UpsertProductUseCase,
  ) {}

  async execute(request: ImportProductsRequest): Promise<ImportProductsResult> {
    const existing = await this.products.findAll();
    const bySourceUrl = new Map(existing.map((p) => [p.sourceUrl, p.id]));

    const rows: ImportProductsResult["rows"] = [];
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const item of request.items) {
      const sourceUrl = item.sourceUrl.trim();
      const matchedId = bySourceUrl.get(sourceUrl) ?? null;
      try {
        if (matchedId) {
          if (!request.dryRun) await this.upsertProduct.update(matchedId, item);
          updated += 1;
          rows.push({ sourceUrl, name: item.name, action: "update", matchedId, applied: !request.dryRun, error: null });
        } else {
          if (!request.dryRun) await this.upsertProduct.create(item);
          created += 1;
          rows.push({ sourceUrl, name: item.name, action: "create", matchedId: null, applied: !request.dryRun, error: null });
        }
      } catch (err) {
        errors += 1;
        rows.push({
          sourceUrl,
          name: item.name,
          action: matchedId ? "update" : "create",
          matchedId,
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log(
      `Import sản phẩm ${request.dryRun ? "(dry-run) " : ""}: ${created} mới, ${updated} cập nhật, ${errors} lỗi`,
    );
    return { dryRun: request.dryRun, created, updated, errors, rows };
  }
}
