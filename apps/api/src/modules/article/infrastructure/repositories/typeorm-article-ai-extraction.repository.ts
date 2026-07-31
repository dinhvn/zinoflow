import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  ArticleAiExtractionRecord,
  ArticleAiExtractionRepository,
} from "../../application/ports/article-ai-extraction.repository";
import { ArticleAiExtractionEntity } from "../entities/article-ai-extraction.entity";

@Injectable()
export class TypeOrmArticleAiExtractionRepository implements ArticleAiExtractionRepository {
  constructor(
    @InjectRepository(ArticleAiExtractionEntity)
    private readonly repo: Repository<ArticleAiExtractionEntity>,
  ) {}

  async findByJobId(jobId: string): Promise<ArticleAiExtractionRecord[]> {
    const rows = await this.repo.find({ where: { jobId }, order: { source: "ASC" } });
    return rows.map((r) => ({
      jobId: r.jobId,
      source: r.source,
      sourceUrls: r.sourceUrls,
      extractedSummary: r.extractedSummary,
      extractedAt: r.extractedAt,
    }));
  }

  async upsert(record: ArticleAiExtractionRecord): Promise<void> {
    const entity = new ArticleAiExtractionEntity();
    entity.jobId = record.jobId;
    entity.source = record.source;
    entity.sourceUrls = record.sourceUrls;
    entity.extractedSummary = record.extractedSummary;
    entity.extractedAt = record.extractedAt;
    await this.repo.save(entity);
  }
}
