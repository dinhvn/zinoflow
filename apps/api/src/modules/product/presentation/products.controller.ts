import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  upsertProductRequestSchema,
  type Product,
  type UpsertProductRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ListProductsUseCase } from "../application/use-cases/list-products.usecase";
import { UpsertProductUseCase } from "../application/use-cases/upsert-product.usecase";
import { ListProductCategoriesUseCase } from "../application/use-cases/list-product-categories.usecase";

/** REST man "Sản phẩm" (product-spec §6) */
@Controller("products")
export class ProductsController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly upsertProduct: UpsertProductUseCase,
    private readonly listCategories: ListProductCategoriesUseCase,
  ) {}

  @Get()
  list(): Promise<Product[]> {
    return this.listProducts.execute();
  }

  /** Goi y category cho form (autocomplete) — tu do nhap, khong bang quan ly rieng */
  @Get("categories")
  categories(): Promise<string[]> {
    return this.listCategories.execute();
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
