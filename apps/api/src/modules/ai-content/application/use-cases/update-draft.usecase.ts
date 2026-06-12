import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { UpdateDraftRequest } from "@zinoflow/contracts";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
  type DraftRecord,
} from "../ports/content-draft.repository";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: sua noi dung draft tu editor — LUON tao version moi (spec §5),
 * khong ghi de version cu (de doi chieu lich su + review records).
 * Sua bai da Approved -> job tu dong quay ve InReview (bat buoc duyet lai).
 *
 * Luu y M3: editor sua draftMarkdown (ban publish); article JSON giu nguyen tu
 * ban AI sinh — gates van cham tren JSON + markdown moi nhat.
 */
@Injectable()
export class UpdateDraftUseCase {
  private readonly logger = new Logger(UpdateDraftUseCase.name);

  constructor(
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
  ) {}

  async execute(draftId: string, request: UpdateDraftRequest): Promise<DraftRecord> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) throw new DomainRuleError(`Draft ${draftId} not found`);

    const job = await this.jobs.findById(draft.jobId);
    if (!job) throw new DomainRuleError(`Content job ${draft.jobId} not found`);
    if (job.status === "Rejected") {
      throw new DomainRuleError("Bài đã bị từ chối — tạo job mới thay vì sửa bài cũ");
    }

    // Luon base tren version moi nhat de khong mat noi dung da sua truoc do
    const latest = (await this.drafts.findLatestByJobId(draft.jobId)) ?? draft;

    const newDraft: DraftRecord = {
      id: randomUUID(),
      jobId: latest.jobId,
      version: latest.version + 1,
      // Neu nguoi dung doi H1 trong markdown thi cap nhat title theo
      title: extractH1(request.draftMarkdown) ?? latest.title,
      outline: latest.outline,
      article: latest.article,
      draftMarkdown: request.draftMarkdown,
      createdAt: new Date(),
    };
    await this.drafts.save(newDraft);

    // Spec §5: approved draft bi sua noi dung -> version moi + quay ve InReview
    if (job.status === "Approved") {
      job.transitionTo("InReview");
      await this.jobs.save(job);
      this.logger.log(`Job ${job.id}: draft edited after approve -> back to InReview`);
    }

    return newDraft;
  }
}

/** Lay dong "# ..." dau tien lam title. */
function extractH1(markdown: string): string | null {
  const match = markdown.match(/^# (.+)$/m);
  return match?.[1]?.trim() ?? null;
}
