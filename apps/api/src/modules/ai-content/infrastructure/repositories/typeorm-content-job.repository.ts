import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { ContentJobStatus } from "@zinoflow/contracts";
import { ContentJob } from "../../domain/content-job";
import type { ContentJobFilters, ContentJobRepository } from "../../application/ports/content-job.repository";
import { ContentJobEntity } from "../entities/content-job.entity";

/**
 * TypeORM implementation cua ContentJobRepository.
 * Mapping domain <-> entity nam tron trong file nay — domain khong biet TypeORM.
 */
@Injectable()
export class TypeOrmContentJobRepository implements ContentJobRepository {
  constructor(
    @InjectRepository(ContentJobEntity)
    private readonly repo: Repository<ContentJobEntity>,
  ) {}

  async save(job: ContentJob): Promise<void> {
    await this.repo.save(this.toEntity(job));
  }

  async findById(id: string): Promise<ContentJob | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(filters?: ContentJobFilters): Promise<ContentJob[]> {
    const entities = await this.repo.find({
      where: {
        ...(filters?.siteCode ? { siteCode: filters.siteCode } : {}),
        ...(filters?.articleType ? { articleType: filters.articleType } : {}),
        ...(filters?.aiProvider ? { aiProvider: filters.aiProvider } : {}),
      },
      order: { createdAt: "DESC" },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findStatusesByIds(ids: string[]): Promise<Map<string, ContentJobStatus>> {
    if (ids.length === 0) return new Map();
    const rows = await this.repo.find({
      where: { id: In(ids) },
      select: { id: true, status: true },
    });
    return new Map(rows.map((r) => [r.id, r.status as ContentJobStatus]));
  }

  async findLatestBySourceRef(siteCode: string, sourceRef: string): Promise<ContentJob | null> {
    const entity = await this.repo.findOne({
      where: { siteCode, sourceRef },
      order: { createdAt: "DESC" },
    });
    return entity ? this.toDomain(entity) : null;
  }

  private toEntity(job: ContentJob): ContentJobEntity {
    const s = job.toSnapshot();
    const entity = new ContentJobEntity();
    entity.id = s.id;
    entity.siteCode = s.siteCode;
    entity.sourceType = s.sourceType;
    entity.sourceRef = s.sourceRef;
    entity.topic = s.topic;
    entity.articleType = s.articleType;
    entity.keywordSeed = s.keywordSeed;
    entity.toneProfile = s.toneProfile;
    entity.sourceContext = s.sourceContext;
    entity.contentTier = s.contentTier;
    entity.comparisonKey = s.comparisonKey;
    entity.originalityExcerpt = s.originalityExcerpt;
    entity.coverImageId = s.coverImageId;
    entity.status = s.status;
    entity.aiProvider = s.aiProvider;
    entity.aiModel = s.aiModel;
    entity.createdAt = s.createdAt;
    entity.updatedAt = s.updatedAt;
    return entity;
  }

  private toDomain(entity: ContentJobEntity): ContentJob {
    return ContentJob.restore({
      id: entity.id,
      siteCode: entity.siteCode,
      sourceType: entity.sourceType,
      sourceRef: entity.sourceRef,
      topic: entity.topic,
      articleType: entity.articleType,
      keywordSeed: entity.keywordSeed,
      toneProfile: entity.toneProfile,
      sourceContext: entity.sourceContext,
      contentTier: entity.contentTier,
      comparisonKey: entity.comparisonKey,
      originalityExcerpt: entity.originalityExcerpt,
      coverImageId: entity.coverImageId,
      status: entity.status,
      aiProvider: entity.aiProvider,
      aiModel: entity.aiModel,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
