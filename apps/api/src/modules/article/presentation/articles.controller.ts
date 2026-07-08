import { Controller, Param, Post } from "@nestjs/common";
import type {
  PublishArticleResult,
  RefreshAllDynamicBlocksReport,
  RefreshDynamicBlocksResult,
} from "@zinoflow/contracts";
import { PublishArticleUseCase } from "../application/use-cases/publish-article.usecase";
import { RefreshDynamicBlocksUseCase } from "../application/use-cases/refresh-dynamic-blocks.usecase";
import { RefreshAllDynamicBlocksUseCase } from "../application/use-cases/refresh-all-dynamic-blocks.usecase";

/** REST bai cam nang (article-spec §9) */
@Controller("articles")
export class ArticlesController {
  constructor(
    private readonly publishArticle: PublishArticleUseCase,
    private readonly refreshDynamicBlocks: RefreshDynamicBlocksUseCase,
    private readonly refreshAllDynamicBlocks: RefreshAllDynamicBlocksUseCase,
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
}
