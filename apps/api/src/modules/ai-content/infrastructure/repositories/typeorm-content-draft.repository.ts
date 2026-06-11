import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Article, ArticleOutline } from "@zinoflow/contracts";
import type {
  ContentDraftRepository,
  DraftRecord,
} from "../../application/ports/content-draft.repository";
import { ContentDraftEntity } from "../entities/content-draft.entity";

@Injectable()
export class TypeOrmContentDraftRepository implements ContentDraftRepository {
  constructor(
    @InjectRepository(ContentDraftEntity)
    private readonly repo: Repository<ContentDraftEntity>,
  ) {}

  async save(draft: DraftRecord): Promise<void> {
    const entity = new ContentDraftEntity();
    entity.id = draft.id;
    entity.jobId = draft.jobId;
    entity.version = draft.version;
    entity.title = draft.title;
    entity.outlineJson = draft.outline;
    entity.articleJson = draft.article;
    entity.draftMarkdown = draft.draftMarkdown;
    entity.qualityScore = null; // quality gates cham diem o M3
    entity.createdAt = draft.createdAt;
    entity.updatedAt = draft.createdAt;
    await this.repo.save(entity);
  }

  async findLatestByJobId(jobId: string): Promise<DraftRecord | null> {
    const entity = await this.repo.findOne({
      where: { jobId },
      order: { version: "DESC" },
    });
    if (!entity) return null;
    return {
      id: entity.id,
      jobId: entity.jobId,
      version: entity.version,
      title: entity.title,
      // jsonb da duoc validate bang Zod truoc khi luu — cast lai dung type
      outline: entity.outlineJson as ArticleOutline | null,
      article: entity.articleJson as Article | null,
      draftMarkdown: entity.draftMarkdown,
      createdAt: entity.createdAt,
    };
  }
}
