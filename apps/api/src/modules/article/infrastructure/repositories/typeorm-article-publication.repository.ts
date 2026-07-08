import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ArticlePublicationEntity } from "../entities/article-publication.entity";
import type {
  ArticlePublicationRecord,
  ArticlePublicationRepository,
} from "../../application/ports/article-publication.repository";

@Injectable()
export class TypeOrmArticlePublicationRepository implements ArticlePublicationRepository {
  constructor(
    @InjectRepository(ArticlePublicationEntity)
    private readonly repo: Repository<ArticlePublicationEntity>,
  ) {}

  async findByJobId(jobId: string): Promise<ArticlePublicationRecord | null> {
    return this.repo.findOneBy({ jobId });
  }

  async findBySlug(slug: string): Promise<ArticlePublicationRecord | null> {
    return this.repo.findOneBy({ slug });
  }

  async upsert(record: Omit<ArticlePublicationRecord, "lastRefreshedAt">): Promise<void> {
    await this.repo.upsert({ ...record, lastRefreshedAt: null }, ["jobId"]);
  }

  async markRefreshed(jobId: string, at: Date): Promise<void> {
    await this.repo.update({ jobId }, { lastRefreshedAt: at });
  }

  async listAll(): Promise<ArticlePublicationRecord[]> {
    return this.repo.find();
  }
}
