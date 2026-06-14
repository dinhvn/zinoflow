import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ListCmsPostsQuery } from "@zinoflow/contracts";
import { CmsPostMirrorEntity } from "../entities/cms-post-mirror.entity";
import type {
  CmsPostMirrorListResult,
  CmsPostMirrorRepository,
} from "../../application/ports/cms-post-mirror.repository";
import type { CmsPostRow } from "../../domain/cms-post";
import { compareCmsPostsForSort, deriveCmsContentState } from "../../domain/cms-post";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";

/** Repository mirror bai viet CMS tren Postgres (implement port application). */
@Injectable()
export class TypeOrmCmsPostMirrorRepository implements CmsPostMirrorRepository {
  constructor(
    @InjectRepository(CmsPostMirrorEntity)
    private readonly repo: Repository<CmsPostMirrorEntity>,
  ) {}

  findByCmsId(cmsId: number): Promise<CmsPostMirrorEntity | null> {
    return this.repo.findOne({ where: { cmsId } });
  }

  findAllBySite(siteId: number): Promise<CmsPostMirrorEntity[]> {
    return this.repo.find({ where: { siteId } });
  }

  async list(siteId: number, query: ListCmsPostsQuery): Promise<CmsPostMirrorListResult> {
    let rows = await this.repo.find({ where: { siteId } });

    if (query.q) {
      const q = normalizeVietnamese(query.q);
      rows = rows.filter((r) => r.titleUnaccented.includes(q));
    }
    if (query.postType !== undefined) {
      rows = rows.filter((r) => r.postType === query.postType);
    }

    // contentState suy ra (domain) — gan vao tung dong de loc + sort
    const enriched = rows.map((r) => ({
      row: r,
      contentState: deriveCmsContentState({
        activeContentJobId: r.activeContentJobId,
        aiContentWrittenAt: r.aiContentWrittenAt,
        datePublished: r.datePublished,
      }),
    }));

    let filtered = enriched;
    if (query.contentState) {
      filtered = filtered.filter((e) => e.contentState === query.contentState);
    }

    const cmp = compareCmsPostsForSort(query.sortBy, query.sortDir);
    filtered.sort((a, b) =>
      cmp(
        { title: a.row.title, postType: a.row.postType, contentState: a.contentState, dateUpdated: a.row.dateUpdated },
        { title: b.row.title, postType: b.row.postType, contentState: b.contentState, dateUpdated: b.row.dateUpdated },
      ),
    );

    const total = filtered.length;
    const start = (query.page - 1) * query.limit;
    const items = filtered.slice(start, start + query.limit).map((e) => e.row);
    return { items, total };
  }

  async upsertFromCms(row: CmsPostRow, syncedAt: Date): Promise<"added" | "updated" | "unchanged"> {
    const existing = await this.repo.findOne({ where: { cmsId: row.cmsId } });
    // Cac cot dong bo tu CMS (KHONG dung den activeContentJobId/aiContentWrittenAt/aiNotes — do AI tool quan ly)
    const synced: Partial<CmsPostMirrorEntity> = {
      siteId: row.siteId,
      postId: row.postId,
      postType: row.postType,
      title: row.title,
      titleUnaccented: normalizeVietnamese(row.title),
      link: row.link,
      isReadyAuto: row.isReadyAuto,
      datePublished: row.datePublished,
      dateUpdated: row.dateUpdated,
      syncedAt,
    };

    if (!existing) {
      await this.repo.insert({ cmsId: row.cmsId, aiReferenceUrls: [], ...synced });
      return "added";
    }
    const changed =
      existing.title !== row.title ||
      existing.postType !== row.postType ||
      existing.postId !== row.postId ||
      existing.isReadyAuto !== row.isReadyAuto ||
      existing.datePublished?.getTime() !== row.datePublished?.getTime();
    await this.repo.update({ cmsId: row.cmsId }, synced);
    return changed ? "updated" : "unchanged";
  }

  async setActiveJob(cmsId: number, jobId: string | null): Promise<void> {
    await this.repo.update({ cmsId }, { activeContentJobId: jobId });
  }

  async saveAiInputs(
    cmsId: number,
    notes: string | null,
    referenceUrls: Array<{ label: string; url: string }>,
  ): Promise<void> {
    await this.repo.update({ cmsId }, { aiNotes: notes, aiReferenceUrls: referenceUrls });
  }

  async saveTagHints(cmsId: number, tagHints: string | null): Promise<void> {
    await this.repo.update({ cmsId }, { aiTagHints: tagHints });
  }

  async createLocal(row: CmsPostRow): Promise<void> {
    await this.repo.insert({
      cmsId: row.cmsId,
      siteId: row.siteId,
      postId: row.postId,
      postType: row.postType,
      title: row.title,
      titleUnaccented: normalizeVietnamese(row.title),
      link: row.link,
      isReadyAuto: row.isReadyAuto,
      aiReferenceUrls: [],
      datePublished: row.datePublished,
      dateUpdated: row.dateUpdated,
      syncedAt: new Date(),
    });
  }

  async markContentWritten(cmsId: number, writtenAt: Date): Promise<void> {
    await this.repo.update({ cmsId }, { aiContentWrittenAt: writtenAt, activeContentJobId: null });
  }
}
