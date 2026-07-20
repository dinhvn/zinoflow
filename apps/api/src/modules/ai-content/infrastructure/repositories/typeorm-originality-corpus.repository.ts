import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { OriginalityCorpusRepository } from "../../application/ports/originality-corpus.repository";
import type { SimilarDestinationExcerpt } from "../../domain/quality-gates/originality-gate";
import { ContentJobEntity } from "../entities/content-job.entity";

/** So trung lap toi da tra ve cho gate — chi can top vai bai giong nhat de hien canh bao. */
const MAX_SIMILAR_RESULTS = 5;

/**
 * TypeORM implementation — dung ham pg_trgm similarity() ngay trong SQL, chi
 * doc du lieu cua chinh module ai-content (content_jobs), khong reach sang
 * module destination.
 */
@Injectable()
export class TypeOrmOriginalityCorpusRepository implements OriginalityCorpusRepository {
  constructor(
    @InjectRepository(ContentJobEntity)
    private readonly repo: Repository<ContentJobEntity>,
  ) {}

  async findSimilar(params: {
    excerpt: string;
    comparisonKey: string;
    articleType: string;
    excludeJobId: string;
  }): Promise<SimilarDestinationExcerpt[]> {
    const rows: Array<{ slug: string; score: number }> = await this.repo.manager.query(
      `
        SELECT source_ref AS slug, similarity(originality_excerpt, $1) AS score
        FROM content_jobs
        WHERE comparison_key = $2
          AND article_type = $3
          AND id != $4
          AND originality_excerpt IS NOT NULL
          AND status = 'Approved'
        ORDER BY score DESC
        LIMIT ${MAX_SIMILAR_RESULTS}
      `,
      [params.excerpt, params.comparisonKey, params.articleType, params.excludeJobId],
    );
    return rows.map((r) => ({ slug: r.slug, score: Number(r.score) }));
  }
}
