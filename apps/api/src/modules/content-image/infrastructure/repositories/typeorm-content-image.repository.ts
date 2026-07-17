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
    const saved = await this.repo.save(this.repo.create({ ...input, status: "active" }));
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
}
