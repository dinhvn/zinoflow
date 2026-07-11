import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  fetchSheetRequestSchema,
  importProductsRequestSchema,
  upsertProductRequestSchema,
  type FetchSheetRequest,
  type FetchSheetResponse,
  type ImportProductsRequest,
  type ImportProductsResult,
  type Product,
  type UpsertProductRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import {
  SHEET_CSV_FETCHER,
  type SheetCsvFetcher,
} from "../../shared/sheet-import/ports/sheet-csv-fetcher.port";
import { ListProductsUseCase } from "../application/use-cases/list-products.usecase";
import { UpsertProductUseCase } from "../application/use-cases/upsert-product.usecase";
import { ImportProductsUseCase } from "../application/use-cases/import-products.usecase";

/** REST man "Sản phẩm" (product-spec §6) */
@Controller("products")
export class ProductsController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly upsertProduct: UpsertProductUseCase,
    private readonly importProducts: ImportProductsUseCase,
    @Inject(SHEET_CSV_FETCHER) private readonly sheetFetcher: SheetCsvFetcher,
  ) {}

  @Get()
  list(): Promise<Product[]> {
    return this.listProducts.execute();
  }

  @Post("fetch-sheet")
  async fetchSheet(
    @Body(new ZodValidationPipe(fetchSheetRequestSchema)) request: FetchSheetRequest,
  ): Promise<FetchSheetResponse> {
    return { csv: await this.sheetFetcher.fetchCsv(request.url) };
  }

  @Post("import")
  importBulk(
    @Body(new ZodValidationPipe(importProductsRequestSchema)) request: ImportProductsRequest,
  ): Promise<ImportProductsResult> {
    return this.importProducts.execute(request);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(upsertProductRequestSchema)) request: UpsertProductRequest,
  ): Promise<Product> {
    return this.upsertProduct.create(request);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertProductRequestSchema)) request: UpsertProductRequest,
  ): Promise<Product> {
    return this.upsertProduct.update(id, request);
  }
}
