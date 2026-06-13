import { Inject, Injectable } from "@nestjs/common";
import type { PromptTemplateDetail } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  PROMPT_TEMPLATE_REPOSITORY,
  type PromptTemplateRepository,
} from "../ports/prompt-template.repository";
import { findCatalogEntry } from "../services/prompt-catalog";
import { DEFAULT_PROMPTS } from "../services/default-prompts";

/**
 * Chi tiet 1 prompt template cho editor: noi dung dang dung + mac dinh + lich su version.
 * activeContent = version active trong DB, hoac DEFAULT_PROMPTS khi chua co row.
 */
@Injectable()
export class GetPromptTemplateUseCase {
  constructor(
    @Inject(PROMPT_TEMPLATE_REPOSITORY)
    private readonly repo: PromptTemplateRepository,
  ) {}

  async execute(key: string): Promise<PromptTemplateDetail> {
    const entry = findCatalogEntry(key);
    if (!entry) throw new DomainRuleError(`Không tìm thấy prompt template "${key}"`);

    const defaultContent = DEFAULT_PROMPTS[key] ?? "";
    const versions = await this.repo.findVersions(key);
    const active = versions.find((v) => v.isActive) ?? null;

    return {
      key: entry.key,
      label: entry.label,
      articleType: entry.articleType,
      operation: entry.operation,
      variables: entry.variables,
      defaultContent,
      activeContent: active?.content ?? defaultContent,
      activeVersion: active?.version ?? null,
      source: active ? "db" : "default",
      versions: versions.map((v) => ({
        version: v.version,
        content: v.content,
        isActive: v.isActive,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }
}
