import { Inject, Injectable } from "@nestjs/common";
import type { PreviewPromptResponse, SuggestTagAssignmentsRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { TAG_SUGGEST_SYSTEM, buildTagSuggestPrompt } from "../../domain/tag-suggest-prompt";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { buildTagSuggestCandidates } from "./tag-suggest-candidates";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Dung prompt se gui AI cho `SuggestTagAssignmentsUseCase` (cung 1 danh sach diem
 * den) — KHONG goi AI that, chi de xem truoc noi dung/kiem tra du lieu nguon
 * (phan hoi nguoi dung 24/07/2026: "cho nao cung co the... xem truoc prompt").
 */
@Injectable()
export class PreviewTagSuggestPromptUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(
    request: Pick<SuggestTagAssignmentsRequest, "destinationSlugs">,
  ): Promise<PreviewPromptResponse> {
    const [tags, assignments, mirrors] = await Promise.all([
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
      this.mirrorRepo.findAll(),
    ]);
    if (tags.length === 0) {
      throw new DomainRuleError(
        "Chưa có tag nào trong hệ thống — chạy phase-b-01-seed-tags.sql trước",
      );
    }

    const candidates = buildTagSuggestCandidates(
      assignments,
      mirrors,
      request.destinationSlugs,
    );
    const prompt = buildTagSuggestPrompt(tags, candidates);

    return {
      sections: [
        { title: "System prompt", text: TAG_SUGGEST_SYSTEM },
        { title: `Prompt (${candidates.length} điểm đến)`, text: prompt },
      ],
    };
  }
}
