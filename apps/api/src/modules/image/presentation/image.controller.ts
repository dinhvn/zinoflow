import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  Body,
} from "@nestjs/common";
import type { Response } from "express";
import { createReadStream } from "node:fs";
import { basename, resolve } from "node:path";
import {
  createImageJobRequestSchema,
  productSearchQuerySchema,
  type CreateImageJobRequest,
  type CreateImageJobResponse,
  type ImageJobDetail,
  type ProductSearchQuery,
  type ProductSearchResult,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { UpstreamApiError, ValidationError } from "../../shared/errors/app-error";
import { SearchProductsUseCase } from "../application/use-cases/search-products.usecase";
import { CreateImageJobUseCase } from "../application/use-cases/create-image-job.usecase";
import { GetImageJobUseCase } from "../application/use-cases/get-image-job.usecase";

/**
 * REST khu Image tool (spec §11): tim san pham, tao job render, lay trang thai,
 * tai file da render, va proxy anh external (render-safe / CORS — spec §12).
 */
@Controller("images")
export class ImageController {
  constructor(
    private readonly searchProducts: SearchProductsUseCase,
    private readonly createJob: CreateImageJobUseCase,
    private readonly getJob: GetImageJobUseCase,
  ) {}

  /** Buoc 1: tim san pham tu CMS cu. */
  @Get("products")
  searchProductList(
    @Query(new ZodValidationPipe(productSearchQuerySchema)) query: ProductSearchQuery,
  ): Promise<ProductSearchResult> {
    return this.searchProducts.execute(query);
  }

  /** Buoc 5: tao job render batch (enqueue, render async). */
  @Post("jobs")
  create(
    @Body(new ZodValidationPipe(createImageJobRequestSchema)) request: CreateImageJobRequest,
  ): Promise<CreateImageJobResponse> {
    return this.createJob.execute(request);
  }

  /** Trang thai + outputs cua job. */
  @Get("jobs/:jobId")
  detail(@Param("jobId") jobId: string): Promise<ImageJobDetail> {
    return this.getJob.execute(jobId);
  }

  /** Tai 1 anh da render theo index. */
  @Get("jobs/:jobId/file/:index")
  async downloadFile(
    @Param("jobId") jobId: string,
    @Param("index") index: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const detail = await this.getJob.execute(jobId);
    const output = detail.outputs.find((o) => o.index === Number(index));
    if (!output || output.status !== "Completed" || !output.file) {
      throw new ValidationError(`Anh ${index} cua job ${jobId} chua co (chua render xong hoac loi)`);
    }
    const safePath = this.assertUnderOutputDir(output.file);
    res.set({ "Content-Disposition": `attachment; filename="${basename(safePath)}"` });
    return new StreamableFile(createReadStream(safePath));
  }

  /** Proxy anh external — render-safe + CORS cho preview (spec §12). Chan SSRF bang whitelist. */
  @Get("asset")
  async proxyAsset(
    @Query("src") src: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!src || !/^https?:\/\//i.test(src)) throw new ValidationError("src phai la URL http(s)");
    this.assertAllowedHost(src);
    let upstream: Response | globalThis.Response;
    try {
      upstream = await fetch(src, { signal: AbortSignal.timeout(12_000) });
    } catch (err) {
      throw new UpstreamApiError(`Khong tai duoc anh: ${err instanceof Error ? err.message : err}`);
    }
    if (!upstream.ok) throw new UpstreamApiError(`Anh tra ve ${upstream.status}`);
    res.set({
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    });
    return new StreamableFile(Buffer.from(await upstream.arrayBuffer()));
  }

  /** Chan path traversal: file phai nam trong IMAGE_OUTPUT_DIR (mac dinh ./outputs/images). */
  private assertUnderOutputDir(file: string): string {
    const base = resolve(process.env.IMAGE_OUTPUT_DIR ?? "./outputs/images");
    const safe = resolve(file);
    if (!safe.startsWith(base)) throw new ValidationError("Duong dan file khong hop le");
    return safe;
  }

  /** Whitelist host anh: lay tu env CMS_*_BASE_URL. Rong -> cho qua (dev), nhung chan IP private. */
  private assertAllowedHost(src: string): void {
    const host = new URL(src).hostname;
    const allowed = [process.env.CMS_PRODUCT_API_BASE_URL, process.env.CMS_MEDIA_BASE_URL]
      .filter((b): b is string => !!b)
      .map((b) => safeHost(b))
      .filter((h): h is string => !!h);

    if (allowed.length > 0) {
      if (!allowed.includes(host)) throw new ValidationError(`Host anh khong duoc phep: ${host}`);
      return;
    }
    // Khong cau hinh whitelist -> chi chan dia chi noi bo de tranh SSRF (tru localhost CMS dev).
    if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      throw new ValidationError(`Host anh bi chan (private): ${host}`);
    }
  }
}

function safeHost(base: string): string | null {
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}
