import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ArticleType, ContentSection } from "@zinoflow/contracts";
import type { OutlineLike } from "./article-type-profiles";
import type { StructuredGenerationRequest } from "../ports/content-ai-provider.port";
import type { ProductContext } from "../ports/product-catalog.port";
import {
  PROMPT_TEMPLATE_REPOSITORY,
  type PromptTemplateRepository,
} from "../ports/prompt-template.repository";
import { DEFAULT_PROMPTS, PROMPT_KEYS } from "./default-prompts";
import { renderPromptTemplate } from "./prompt-template.renderer";

/**
 * Build prompt cho 3 buoc generation (outline -> section -> frame).
 * Template doc tu DB (prompt_templates, version active moi nhat);
 * fallback ve DEFAULT_PROMPTS neu DB chua co row — he thong khong bao gio chet vi thieu prompt.
 *
 * Provider adapter KHONG duoc tu build prompt — moi prompt di qua day
 * de doi prompt khong phai sua code adapter.
 */

export interface PromptJobContext {
  model: string;
  articleType: ArticleType;
  topic: string;
  siteCode: string;
  keywordSeed: readonly string[];
  toneProfile: string | null;
  /** Ngu canh nguon (du lieu diem den, content cu khi update...) — null voi bai thuong */
  sourceContext: string | null;
  products: readonly ProductContext[];
}

// max_tokens theo do dai du kien cua tung buoc (output JSON)
const MAX_TOKENS = { outline: 8_000, section: 4_000, frame: 12_000 } as const;

@Injectable()
export class PromptBuilder {
  private readonly logger = new Logger(PromptBuilder.name);

  constructor(
    @Inject(PROMPT_TEMPLATE_REPOSITORY)
    private readonly templates: PromptTemplateRepository,
  ) {}

  async buildOutline(ctx: PromptJobContext): Promise<StructuredGenerationRequest> {
    const vars = this.baseVars(ctx);
    return {
      model: ctx.model,
      operation: "outline",
      system: await this.loadTemplate(PROMPT_KEYS.system),
      prompt: renderPromptTemplate(
        await this.loadTemplate(PROMPT_KEYS.outline(ctx.articleType)),
        vars,
      ),
      maxTokens: MAX_TOKENS.outline,
      vars,
    };
  }

  async buildSection(
    ctx: PromptJobContext,
    outline: OutlineLike,
    sectionHeading: string,
  ): Promise<StructuredGenerationRequest> {
    const vars = {
      ...this.baseVars(ctx),
      title: outline.title,
      outline,
      sectionHeading,
    };
    return {
      model: ctx.model,
      operation: "section",
      system: await this.loadTemplate(PROMPT_KEYS.system),
      prompt: renderPromptTemplate(
        await this.loadTemplate(PROMPT_KEYS.section(ctx.articleType)),
        vars,
      ),
      maxTokens: MAX_TOKENS.section,
      vars,
    };
  }

  async buildFrame(
    ctx: PromptJobContext,
    outline: OutlineLike,
    sections: readonly ContentSection[],
  ): Promise<StructuredGenerationRequest> {
    const vars = {
      ...this.baseVars(ctx),
      title: outline.title,
      outline,
      // Chi dua heading + cau dau cua moi section de frame khong lap lai noi dung
      sectionsSummary: sections.map((s) => ({
        heading: s.heading,
        firstSentence: s.content.split(/(?<=[.!?])\s/)[0] ?? "",
      })),
    };
    return {
      model: ctx.model,
      operation: "frame",
      system: await this.loadTemplate(PROMPT_KEYS.system),
      prompt: renderPromptTemplate(
        await this.loadTemplate(PROMPT_KEYS.frame(ctx.articleType)),
        vars,
      ),
      maxTokens: MAX_TOKENS.frame,
      vars,
    };
  }

  private baseVars(ctx: PromptJobContext): Record<string, unknown> {
    const now = new Date();
    return {
      // articleType khong dung trong template — stub provider can de chon shape output
      articleType: ctx.articleType,
      // "MM/YYYY" cho updateNotice — model hay tu suy thang/nam sai theo kien thuc nen
      currentDate: `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`,
      topic: ctx.topic,
      keywords: ctx.keywordSeed.join(", ") || "(tự suy ra từ chủ đề)",
      siteCode: ctx.siteCode,
      toneProfile: ctx.toneProfile ?? "tự nhiên, gần gũi, trung thực",
      sourceContext: ctx.sourceContext ?? "(không có — dùng kiến thức nền, ghi rõ chỗ cần kiểm chứng)",
      products: ctx.products,
    };
  }

  /** DB truoc, fallback DEFAULT_PROMPTS — chi warn 1 dong khi fallback. */
  private async loadTemplate(templateKey: string): Promise<string> {
    const record = await this.templates.findActive(templateKey);
    if (record) return record.content;

    const fallback = DEFAULT_PROMPTS[templateKey];
    if (!fallback) {
      // Sai articleType/templateKey la bug lap trinh, khong phai loi runtime cua user
      throw new Error(`No prompt template found for key "${templateKey}" (DB + defaults)`);
    }
    this.logger.warn(`Prompt template "${templateKey}" not in DB - using built-in default`);
    return fallback;
  }
}
