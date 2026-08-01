import { Injectable, Inject } from "@nestjs/common";
import type { ContentJobProps } from "../../domain/content-job";
import type { PromptJobContext } from "./prompt-builder";
import type { ArticleTypeProfile } from "./article-type-profiles";
import { PRODUCT_CATALOG, type ProductCatalog } from "../ports/product-catalog.port";

/**
 * Build PromptJobContext tu 1 ContentJob — dung chung cho luong sync
 * (GenerateContentUseCase) va batch (ContentOutlineBatchTaskHandler/
 * ContentArticleBatchTaskHandler), tach ra de khong lap lai logic goi
 * catalog.findProducts + gan temperature theo articleType.
 */
@Injectable()
export class ContentJobContextBuilder {
  constructor(@Inject(PRODUCT_CATALOG) private readonly catalog: ProductCatalog) {}

  async build(
    snapshot: Readonly<ContentJobProps>,
    profile: ArticleTypeProfile,
  ): Promise<PromptJobContext> {
    const products = profile.usesProductCatalog
      ? await this.catalog.findProducts({
          siteCode: snapshot.siteCode,
          topic: snapshot.topic,
          keywords: snapshot.keywordSeed,
        })
      : [];
    return {
      model: snapshot.aiModel,
      articleType: snapshot.articleType,
      topic: snapshot.topic,
      siteCode: snapshot.siteCode,
      keywordSeed: snapshot.keywordSeed,
      toneProfile: snapshot.toneProfile,
      sourceContext: snapshot.sourceContext,
      contentTier: snapshot.contentTier,
      nodeKind: snapshot.nodeKind,
      products,
      // Chi bai diem den (dichoithoi) — KHONG dat 1 gia tri chung cho ca site
      // laruki/dochoi3s (Muc B, dichoithoi-destination-ai-extraction-plan §6 D3).
      // 0.5: cau tu mem mai/giau cam xuc hon nhung van bam sat sourceContext that.
      temperature: snapshot.articleType === "guide-diem-den" ? 0.5 : undefined,
    };
  }
}
