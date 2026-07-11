import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ArticleType, ContentSection } from "@zinoflow/contracts";
import type { OutlineLike } from "./article-type-profiles";
import type { StructuredGenerationRequest } from "../ports/content-ai-provider.port";
import type { ProductContext } from "../ports/product-catalog.port";
import {
  PROMPT_TEMPLATE_REPOSITORY,
  type PromptTemplateRepository,
} from "../ports/prompt-template.repository";
import { DEFAULT_PROMPTS, SYSTEM_PROMPT_KEY } from "./default-prompts";
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
  /**
   * flagship | standard | null — chi y nghia voi articleType guide-diem-den
   * (Phase 28.3): chon prompt Flagship rieng khi = "flagship", fallback ve
   * prompt guide-diem-den binh thuong voi moi gia tri khac.
   */
  contentTier?: "flagship" | "standard" | null;
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
      system: await this.resolveTemplate(this.systemKeys(ctx)),
      prompt: renderPromptTemplate(await this.resolveTemplate(this.stepKeys("outline", ctx)), vars),
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
      system: await this.resolveTemplate(this.systemKeys(ctx)),
      prompt: renderPromptTemplate(await this.resolveTemplate(this.stepKeys("section", ctx)), vars),
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
      system: await this.resolveTemplate(this.systemKeys(ctx)),
      prompt: renderPromptTemplate(await this.resolveTemplate(this.stepKeys("frame", ctx)), vars),
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

  /**
   * Cac key prompt ung vien cho 1 buoc, tu CU THE -> CHUNG (spec laruki-dochoi3s §4):
   * <site>.<articleType>.<step> -> <articleType>.<step>
   * (bai km them: -> <site>.km-bai-viet.<step> -> km-bai-viet.<step>)
   */
  private stepKeys(step: "outline" | "section" | "frame", ctx: PromptJobContext): string[] {
    const at = ctx.articleType;
    const site = ctx.siteCode;
    const keys: string[] = [];
    // Phase 28.3 — diem den Flagship dung bo prompt rieng (mua/thoi diem, di
    // chuyen 2 chieu, an gi dac trung, qua mang ve... thay vi khung POI thuong),
    // uu tien TRUOC cap key guide-diem-den binh thuong; tier != "flagship"
    // (standard/null) roi thang xuong cap duoi, khong doi hanh vi cu.
    if (at === "guide-diem-den" && ctx.contentTier === "flagship") {
      keys.push(`${site}.guide-diem-den-flagship.${step}.vi`, `guide-diem-den-flagship.${step}.vi`);
    }
    keys.push(`${site}.${at}.${step}.vi`, `${at}.${step}.vi`);
    if (at.startsWith("km-")) {
      keys.push(`${site}.km-bai-viet.${step}.vi`, `km-bai-viet.${step}.vi`);
    }
    return keys;
  }

  private systemKeys(ctx: PromptJobContext): string[] {
    return [`${ctx.siteCode}.${SYSTEM_PROMPT_KEY}`, SYSTEM_PROMPT_KEY];
  }

  /**
   * Phan giai 1 prompt theo danh sach key cu the->chung: uu tien DB (bat ky key nao),
   * roi den DEFAULT_PROMPTS. DB override luon thang baseline; trong cung nguon, key cu the thang.
   */
  private async resolveTemplate(keys: string[]): Promise<string> {
    for (const key of keys) {
      const record = await this.templates.findActive(key);
      if (record) return record.content;
    }
    for (const key of keys) {
      const fallback = DEFAULT_PROMPTS[key];
      if (fallback) {
        // keys[1] = "<articleType>.<step>" la default binh thuong (khong on ao);
        // chi warn khi roi xa hon (vd km dung default chung thay vi per-site/postType).
        if (key !== keys[1]) {
          this.logger.warn(`Prompt "${keys[0]}" -> dung default "${key}"`);
        }
        return fallback;
      }
    }
    throw new Error(`No prompt template for keys: ${keys.join(", ")}`);
  }
}
