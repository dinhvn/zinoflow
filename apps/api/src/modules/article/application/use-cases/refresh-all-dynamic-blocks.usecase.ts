import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RefreshAllDynamicBlocksReport } from "@zinoflow/contracts";
import {
  ARTICLE_PUBLICATION_REPOSITORY,
  type ArticlePublicationRepository,
} from "../ports/article-publication.repository";
import { RefreshDynamicBlocksUseCase } from "./refresh-dynamic-blocks.usecase";

/** Batch "Làm mới toàn bộ bài có khối động" (article-spec §7, màn Công cụ) */
@Injectable()
export class RefreshAllDynamicBlocksUseCase {
  private readonly logger = new Logger(RefreshAllDynamicBlocksUseCase.name);

  constructor(
    @Inject(ARTICLE_PUBLICATION_REPOSITORY)
    private readonly publications: ArticlePublicationRepository,
    private readonly refreshOne: RefreshDynamicBlocksUseCase,
  ) {}

  async execute(): Promise<RefreshAllDynamicBlocksReport> {
    const startedAt = Date.now();
    const all = await this.publications.listAll();
    const failures: Array<{ jobId: string; slug: string; message: string }> = [];
    let totalRefreshed = 0;

    for (const pub of all) {
      try {
        await this.refreshOne.execute(pub.jobId);
        totalRefreshed++;
      } catch (error) {
        failures.push({
          jobId: pub.jobId,
          slug: pub.slug,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.log(`Làm mới toàn bộ: ${totalRefreshed}/${all.length} bài, ${failures.length} lỗi`);
    return { totalChecked: all.length, totalRefreshed, failures, durationMs: Date.now() - startedAt };
  }
}
