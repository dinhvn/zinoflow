import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ContentJob } from "../../domain/content-job";
import type { ContentJobRepository } from "../../application/ports/content-job.repository";
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

  async findAll(): Promise<ContentJob[]> {
    const entities = await this.repo.find({ order: { createdAt: "DESC" } });
    return entities.map((entity) => this.toDomain(entity));
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
      status: entity.status,
      aiProvider: entity.aiProvider,
      aiModel: entity.aiModel,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
