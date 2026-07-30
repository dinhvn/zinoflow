import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { ArticleType } from "@zinoflow/contracts";
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
  /**
   * CHI Gemini doc (Anthropic bo qua — spec §5). Khong set = provider tu default.
   * Scope RIENG theo caller — KHONG set 1 gia tri chung cho ca pipeline, de
   * pipeline chung (laruki/dochoi3s) khong bi anh huong boi quyet dinh cua
   * dichoithoi (dichoithoi-destination-ai-extraction-plan §6 D3 Muc B).
   */
  temperature?: number;
}

// max_tokens theo do dai du kien cua tung buoc (output JSON). "content" (Option 3,
// 09/2026) gop section+frame cu lam 1 lan goi — ngan sach = tong 2 buoc cu (~ 7 khoi
// + frame) cong them de du cho JSON scaffolding cua 1 object lon hon.
const MAX_TOKENS = { outline: 8_000, section: 4_000, content: 24_000 } as const;

@Injectable()
export class PromptBuilder {
  private readonly logger = new Logger(PromptBuilder.name);

  constructor(
    @Inject(PROMPT_TEMPLATE_REPOSITORY)
    private readonly templates: PromptTemplateRepository,
  ) {}

  async buildOutline(
    ctx: PromptJobContext,
  ): Promise<StructuredGenerationRequest> {
    const vars = this.baseVars(ctx);
    const system = await this.resolveTemplate(this.systemKeys(ctx));
    const step = await this.resolveTemplate(this.stepKeys("outline", ctx));
    return {
      model: ctx.model,
      operation: "outline",
      system: system.content,
      prompt: renderPromptTemplate(step.content, vars),
      promptTrace: this.toTrace(step, ctx.sourceContext),
      maxTokens: MAX_TOKENS.outline,
      vars,
      temperature: ctx.temperature,
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
    const system = await this.resolveTemplate(this.systemKeys(ctx));
    const step = await this.resolveTemplate(this.stepKeys("section", ctx));
    return {
      model: ctx.model,
      operation: "section",
      system: system.content,
      prompt: renderPromptTemplate(step.content, vars),
      promptTrace: this.toTrace(step, ctx.sourceContext),
      maxTokens: MAX_TOKENS.section,
      vars,
      temperature: ctx.temperature,
    };
  }

  /**
   * Buoc 2 (Option 3, gop pipeline 09/2026) — sinh TOAN BO bai (moi section +
   * frame: intro/quickFacts/faq/metadata...) trong 1 lan goi AI duy nhat, thay
   * vi 1 request/section + 1 request frame rieng (9 request cho bai diem den
   * truoc day). Ly do: model viet frame ma KHONG thay het noi dung sections da
   * viet (chi thay outline) gay trung lap that (vd mo bai lap lai "Tong quan",
   * quickFacts.food/transport lap lai section an-gi/di-chuyen — phat hien
   * 07/2026). Gop lam 1 request giai quyet tan goc vi model thay toan bo noi
   * dung no dang viet trong cung 1 luot, dong thoi giam manh token overhead
   * (system prompt chi gui 1 lan thay vi 7-9 lan).
   */
  async buildContent(
    ctx: PromptJobContext,
    outline: OutlineLike,
  ): Promise<StructuredGenerationRequest> {
    const vars = {
      ...this.baseVars(ctx),
      title: outline.title,
      outline,
    };
    const system = await this.resolveTemplate(this.systemKeys(ctx));
    const step = await this.resolveTemplate(this.stepKeys("content", ctx));
    return {
      model: ctx.model,
      operation: "content",
      system: system.content,
      prompt: renderPromptTemplate(step.content, vars),
      promptTrace: this.toTrace(step, ctx.sourceContext),
      maxTokens: MAX_TOKENS.content,
      vars,
      temperature: ctx.temperature,
    };
  }

  private baseVars(ctx: PromptJobContext): Record<string, unknown> {
    return {
      // articleType khong dung trong template — stub provider can de chon shape output
      articleType: ctx.articleType,
      topic: ctx.topic,
      keywords: ctx.keywordSeed.join(", ") || "(tự suy ra từ chủ đề)",
      siteCode: ctx.siteCode,
      toneProfile: ctx.toneProfile ?? "tự nhiên, gần gũi, trung thực",
      sourceContext:
        ctx.sourceContext ??
        "(không có — dùng kiến thức nền, ghi rõ chỗ cần kiểm chứng)",
      products: ctx.products,
    };
  }

  /**
   * Cac key prompt ung vien cho 1 buoc, tu CU THE -> CHUNG (spec laruki-dochoi3s §4):
   * <site>.<articleType>.<step> -> <articleType>.<step>
   * (bai km them: -> <site>.km-bai-viet.<step> -> km-bai-viet.<step>)
   */
  private stepKeys(
    step: "outline" | "section" | "content",
    ctx: PromptJobContext,
  ): string[] {
    const at = ctx.articleType;
    const site = ctx.siteCode;
    const keys: string[] = [];
    // Phase 28.3 — diem den Flagship dung bo prompt rieng (mua/thoi diem, di
    // chuyen 2 chieu, an gi dac trung, qua mang ve... thay vi khung POI thuong),
    // uu tien TRUOC cap key guide-diem-den binh thuong; tier != "flagship"
    // (standard/null) roi thang xuong cap duoi, khong doi hanh vi cu.
    if (at === "guide-diem-den" && ctx.contentTier === "flagship") {
      keys.push(
        `${site}.guide-diem-den-flagship.${step}.vi`,
        `guide-diem-den-flagship.${step}.vi`,
      );
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
  private async resolveTemplate(
    keys: string[],
  ): Promise<{
    key: string;
    version: number | null;
    source: "db" | "default";
    content: string;
  }> {
    for (const key of keys) {
      const record = await this.templates.findActive(key);
      if (record)
        return {
          key,
          version: record.version,
          source: "db",
          content: record.content,
        };
    }
    for (const key of keys) {
      const fallback = DEFAULT_PROMPTS[key];
      if (fallback) {
        // keys[1] = "<articleType>.<step>" la default binh thuong (khong on ao);
        // chi warn khi roi xa hon (vd km dung default chung thay vi per-site/postType).
        if (key !== keys[1]) {
          this.logger.warn(`Prompt "${keys[0]}" -> dung default "${key}"`);
        }
        return { key, version: null, source: "default", content: fallback };
      }
    }
    throw new Error(`No prompt template for keys: ${keys.join(", ")}`);
  }

  private toTrace(
    template: { key: string; version: number | null; source: "db" | "default" },
    sourceContext: string | null,
  ): NonNullable<StructuredGenerationRequest["promptTrace"]> {
    return {
      key: template.key,
      version: template.version,
      source: template.source,
      sourceContextHash: sourceContext
        ? createHash("sha256").update(sourceContext).digest("hex")
        : null,
    };
  }
}
