import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import {
  saveArticleDestinationMapRequestSchema,
  type ArticleDestinationMapResponse,
  type PublishArticleResult,
  type RefreshAllDynamicBlocksReport,
  type RefreshDynamicBlocksResult,
  type SaveArticleDestinationMapRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { PublishArticleUseCase } from "../application/use-cases/publish-article.usecase";
import { RefreshDynamicBlocksUseCase } from "../application/use-cases/refresh-dynamic-blocks.usecase";
import { RefreshAllDynamicBlocksUseCase } from "../application/use-cases/refresh-all-dynamic-blocks.usecase";
import { GetArticleDestinationMapUseCase } from "../application/use-cases/get-article-destination-map.usecase";
import { SaveArticleDestinationMapUseCase } from "../application/use-cases/save-article-destination-map.usecase";

/** REST bai cam nang (article-spec §9) */
@Controller("articles")
export class ArticlesController {
  constructor(
    private readonly publishArticle: PublishArticleUseCase,
    private readonly refreshDynamicBlocks: RefreshDynamicBlocksUseCase,
    private readonly refreshAllDynamicBlocks: RefreshAllDynamicBlocksUseCase,
    private readonly getDestinationMap: GetArticleDestinationMapUseCase,
    private readonly saveDestinationMap: SaveArticleDestinationMapUseCase,
  ) {}

  /** Publish bai DA DUYET xuong SQL Server (gate thu cong thu 2) */
  @Post(":jobId/publish")
  publish(@Param("jobId") jobId: string): Promise<PublishArticleResult> {
    return this.publishArticle.execute(jobId);
  }

  /** "Làm mới khối động" — khong AI, khong qua review lai (spec §7) */
  @Post(":jobId/refresh-blocks")
  refresh(@Param("jobId") jobId: string): Promise<RefreshDynamicBlocksResult> {
    return this.refreshDynamicBlocks.execute(jobId);
  }

  /** Batch "Làm mới toàn bộ bài có khối động" (man Cong cu) — DAT TRUOC :jobId */
  @Post("refresh-all-blocks")
  refreshAll(): Promise<RefreshAllDynamicBlocksReport> {
    return this.refreshAllDynamicBlocks.execute();
  }

  /** Gan ket Article -> Destination hien tai (article-spec §8.1) */
  @Get(":jobId/destination-map")
  getDestinationMapForJob(@Param("jobId") jobId: string): Promise<ArticleDestinationMapResponse> {
    return this.getDestinationMap.execute(jobId);
  }

  /** Luu tick xac nhan gan diem den + topic (goi y tu addedLinks luc publish) */
  @Put(":jobId/destination-map")
  saveDestinationMapForJob(
    @Param("jobId") jobId: string,
    @Body(new ZodValidationPipe(saveArticleDestinationMapRequestSchema))
    body: SaveArticleDestinationMapRequest,
  ): Promise<void> {
    return this.saveDestinationMap.execute(jobId, body);
  }
}
