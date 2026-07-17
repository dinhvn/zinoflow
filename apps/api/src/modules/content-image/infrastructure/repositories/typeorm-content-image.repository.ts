import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { ContentImageEntity } from "../entities/content-image.entity";
import type {
  ContentImageRecord,
  ContentImageRepository as IContentImageRepository,
  CreateContentImageInput,
  UpdateContentImageInput,
} from "../../application/ports/content-image.repository";

function toRecord(e: ContentImageEntity, usageCount: number): ContentImageRecord {
  return {
    id: e.id,
    path: e.path,
    altText: e.altText,
    caption: e.caption,
    width: e.width,
    height: e.height,
    status: e.status,
    usageCount,
    uploadedAt: e.uploadedAt,
    source: e.source,
    sourceUrl: e.sourceUrl,
    photographer: e.photographer,
    relatedJobId: e.relatedJobId,
    searchKeyword: e.searchKeyword,
  };
}

@Injectable()
export class TypeOrmContentImageRepository implements IContentImageRepository {
  constructor(
    @InjectRepository(ContentImageEntity) private readonly repo: Repository<ContentImageEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** usage_count khong luu tinh (khong tang/giam luc publish) — tinh SONG luc doc
   * bang 1 truy van LIKE-join voi content_drafts, dam bao luon dung so thuc te. */
  async findAll(): Promise<ContentImageRecord[]> {
    const entities = await this.repo.find({ order: { uploadedAt: "DESC" } });
    if (entities.length === 0) return [];

    const counts: Array<{ id: string; count: string }> = await this.dataSource.query(`
      SELECT ci.id, COUNT(cd.id) AS count
      FROM content_images ci
      LEFT JOIN content_drafts cd ON cd.draft_markdown LIKE '%[[block:image id=' || ci.id || ']]%'
      GROUP BY ci.id
    `);
    const countById = new Map(counts.map((row) => [row.id, Number(row.count)]));
    return entities.map((e) => toRecord(e, countById.get(e.id) ?? 0));
  }

  async findById(id: string): Promise<ContentImageRecord | null> {
    const e = await this.repo.findOneBy({ id });
    if (!e) return null;
    return toRecord(e, await this.countReferencesInDrafts(id));
  }

  async create(input: CreateContentImageInput): Promise<ContentImageRecord> {
    const saved = await this.repo.save(
      this.repo.create({
        path: input.path,
        altText: input.altText,
        width: input.width,
        height: input.height,
        status: input.status ?? "active",
        source: input.source ?? null,
        sourceUrl: input.sourceUrl ?? null,
        photographer: input.photographer ?? null,
        relatedJobId: input.relatedJobId ?? null,
        searchKeyword: input.searchKeyword ?? null,
      }),
    );
    return toRecord(saved, 0);
  }

  async update(id: string, input: UpdateContentImageInput): Promise<ContentImageRecord> {
    await this.repo.update({ id }, input);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`ContentImage id=${id} bien mat sau update`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async countReferencesInDrafts(id: string): Promise<number> {
    const rows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM content_drafts WHERE draft_markdown LIKE $1`,
      [`%[[block:image id=${id}]]%`],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async approve(id: string): Promise<ContentImageRecord> {
    await this.repo.update({ id }, { status: "active" });
    const updated = await this.findById(id);
    if (!updated) throw new Error(`ContentImage id=${id} bien mat sau approve`);
    return updated;
  }

  async addRejectedKeyword(jobId: string, keyword: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO content_image_rejected_keywords (job_id, keyword) VALUES ($1, $2)
       ON CONFLICT (job_id, keyword) DO NOTHING`,
      [jobId, keyword],
    );
  }

  async isKeywordRejected(jobId: string, keyword: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM content_image_rejected_keywords WHERE job_id = $1 AND keyword = $2`,
      [jobId, keyword],
    );
    return rows.length > 0;
  }

  async findArticleTitlesByJobIds(jobIds: string[]): Promise<Map<string, string>> {
    if (jobIds.length === 0) return new Map();
    const rows: Array<{ job_id: string; title: string }> = await this.dataSource.query(
      `SELECT DISTINCT ON (job_id) job_id, title
       FROM content_drafts
       WHERE job_id = ANY($1) AND title IS NOT NULL
       ORDER BY job_id, version DESC`,
      [jobIds],
    );
    return new Map(rows.map((r) => [r.job_id, r.title]));
  }
}
