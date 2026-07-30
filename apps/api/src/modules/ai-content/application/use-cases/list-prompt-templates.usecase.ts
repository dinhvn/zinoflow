import { Inject, Injectable } from "@nestjs/common";
import type { PromptTemplateListResponse } from "@zinoflow/contracts";
import {
  PROMPT_TEMPLATE_REPOSITORY,
  type PromptTemplateRepository,
} from "../ports/prompt-template.repository";
import { PROMPT_CATALOG } from "../services/prompt-catalog";

/**
 * Liet ke moi prompt template quan ly duoc (man /prompts).
 * Ghep catalog (nguon key) voi version active trong DB; key chua co row -> source "default".
 */
@Injectable()
export class ListPromptTemplatesUseCase {
  constructor(
    @Inject(PROMPT_TEMPLATE_REPOSITORY)
    private readonly repo: PromptTemplateRepository,
  ) {}

  async execute(): Promise<PromptTemplateListResponse> {
    const keys = PROMPT_CATALOG.map((entry) => entry.key);
    const [active, latest] = await Promise.all([
      this.repo.findActiveMany(keys),
      this.repo.findLatestMany(keys),
    ]);
    const byKey = new Map(active.map((a) => [a.templateKey, a]));
    const latestByKey = new Map(latest.map((row) => [row.templateKey, row]));

    return {
      templates: PROMPT_CATALOG.map((entry) => {
        const row = byKey.get(entry.key);
        return {
          key: entry.key,
          label: entry.label,
          articleType: entry.articleType,
          operation: entry.operation,
          activeVersion: row?.version ?? null,
          latestVersion: latestByKey.get(entry.key)?.version ?? null,
          source: row ? ("db" as const) : ("default" as const),
          updatedAt: row?.createdAt.toISOString() ?? null,
        };
      }),
    };
  }
}
