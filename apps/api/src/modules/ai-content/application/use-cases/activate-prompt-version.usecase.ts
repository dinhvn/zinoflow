import { Inject, Injectable } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  PROMPT_TEMPLATE_REPOSITORY,
  type PromptTemplateRepository,
} from "../ports/prompt-template.repository";
import { findCatalogEntry } from "../services/prompt-catalog";

/**
 * Kich hoat lai 1 version cu (rollback) — bat version do, tat cac version khac cua key.
 */
@Injectable()
export class ActivatePromptVersionUseCase {
  constructor(
    @Inject(PROMPT_TEMPLATE_REPOSITORY)
    private readonly repo: PromptTemplateRepository,
  ) {}

  async execute(key: string, version: number): Promise<{ activeVersion: number }> {
    if (!findCatalogEntry(key)) {
      throw new DomainRuleError(`Không tìm thấy prompt template "${key}"`);
    }
    const versions = await this.repo.findVersions(key);
    if (!versions.some((v) => v.version === version)) {
      throw new DomainRuleError(`Prompt "${key}" không có version ${version}`);
    }
    await this.repo.activateVersion(key, version);
    return { activeVersion: version };
  }
}
