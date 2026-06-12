import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  ReviewRecordEntry,
  ReviewRecordRepository,
} from "../../application/ports/review-record.repository";
import { ContentReviewRecordEntity } from "../entities/content-review-record.entity";
import { ContentDraftEntity } from "../entities/content-draft.entity";

/** TypeORM implementation cua ReviewRecordRepository. */
@Injectable()
export class TypeOrmReviewRecordRepository implements ReviewRecordRepository {
  constructor(
    @InjectRepository(ContentReviewRecordEntity)
    private readonly repo: Repository<ContentReviewRecordEntity>,
  ) {}

  async save(record: ReviewRecordEntry): Promise<void> {
    const entity = new ContentReviewRecordEntity();
    entity.id = record.id;
    entity.draftId = record.draftId;
    entity.action = record.action;
    entity.note = record.note;
    entity.actor = record.actor;
    entity.createdAt = record.createdAt;
    await this.repo.save(entity);
  }

  async listByJobId(jobId: string): Promise<Array<ReviewRecordEntry & { draftVersion: number }>> {
    // Join qua content_drafts de gom lich su review cua MOI version thuoc job
    const rows = await this.repo
      .createQueryBuilder("review")
      .innerJoin(ContentDraftEntity, "draft", "draft.id = review.draft_id")
      .where("draft.job_id = :jobId", { jobId })
      .select([
        'review.id AS "id"',
        'review.draft_id AS "draftId"',
        'review.action AS "action"',
        'review.note AS "note"',
        'review.actor AS "actor"',
        'review.created_at AS "createdAt"',
        'draft.version AS "draftVersion"',
      ])
      .orderBy("review.created_at", "DESC")
      .getRawMany<ReviewRecordEntry & { draftVersion: number }>();
    return rows;
  }
}
