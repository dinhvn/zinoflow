import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { CreatePromptVersionResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  PROMPT_TEMPLATE_REPOSITORY,
  type PromptTemplateRepository,
} from "../ports/prompt-template.repository";
import {
  findCatalogEntry,
  findUnknownPlaceholders,
} from "../services/prompt-catalog";

/**
 * Tao candidate inactive cho 1 prompt template. Activation la lenh rieng co optimistic guard.
 * Tra ve placeholder {{...}} la (khong thuoc bien hop le cua key) de canh bao —
 * KHONG chan luu (system prompt von khong co bien; renderer giu nguyen placeholder la).
 */
@Injectable()
export class CreatePromptVersionUseCase {
  constructor(
    @Inject(PROMPT_TEMPLATE_REPOSITORY)
    private readonly repo: PromptTemplateRepository,
  ) {}

  async execute(
    key: string,
    content: string,
  ): Promise<CreatePromptVersionResponse> {
    const entry = findCatalogEntry(key);
    if (!entry)
      throw new DomainRuleError(`Không tìm thấy prompt template "${key}"`);

    const trimmed = content.trim();
    if (!trimmed)
      throw new DomainRuleError("Nội dung prompt không được để trống");

    const created = await this.repo.createInactiveVersion(key, trimmed);
    return {
      version: created.version,
      contentHash: createHash("sha256").update(trimmed).digest("hex"),
      isActive: false,
      unknownPlaceholders: findUnknownPlaceholders(trimmed, entry.variables),
    };
  }
}
