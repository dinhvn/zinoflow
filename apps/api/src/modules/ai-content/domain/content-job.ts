import type {
  AiProviderKey,
  ArticleCategory,
  ArticleType,
  ContentJobStatus,
  ContentSourceType,
} from "@zinoflow/contracts";
import { assertTransition } from "./content-job-state";
import { DomainRuleError } from "../../shared/errors/app-error";

export interface ContentJobProps {
  id: string;
  siteCode: string;
  sourceType: ContentSourceType;
  sourceRef: string;
  topic: string;
  articleType: ArticleType;
  keywordSeed: string[];
  toneProfile: string | null;
  /** Ngu canh nguon cho prompt (du lieu diem den, content cu...) — null voi bai thuong */
  sourceContext: string | null;
  /** flagship | standard | null — chi y nghia voi articleType guide-diem-den (Phase 28.3) */
  contentTier: "flagship" | "standard" | null;
  /**
   * poi | cluster | province | null — chi y nghia voi articleType guide-diem-den.
   * Quyet dinh PromptBuilder chon bo prompt POI hay Cum (thay Phase 28.3, xem
   * prompt-builder.ts).
   */
  nodeKind: "poi" | "cluster" | "province" | null;
  /** Gate "originality" (07/2026) — pham vi so sanh (vd ma tinh), null = gate tu bo qua. */
  comparisonKey: string | null;
  /** Doan van trich xuat de lam corpus so sanh cho job KHAC — ghi luc Approved. */
  originalityExcerpt: string | null;
  /** Anh dai dien (og:image/JSON-LD image) — CHI y nghia voi articleType cam-nang. */
  coverImageId: string | null;
  /** Danh muc bai cam nang (loc/hien thi /cam-nang/danh-muc) — CHI y nghia voi articleType cam-nang. */
  category: ArticleCategory | null;
  /** Website tham khao — CHI y nghia voi articleType cam-nang (article-ai-extraction-plan.md GĐ1). */
  referenceUrls: string[] | null;
  status: ContentJobStatus;
  aiProvider: AiProviderKey;
  aiModel: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Domain entity — pure TS, khong phu thuoc TypeORM/Nest.
 * Moi thay doi status PHAI di qua transitionTo() de state machine duoc enforce.
 */
export class ContentJob {
  private constructor(private readonly props: ContentJobProps) {}

  static create(input: Omit<ContentJobProps, "status" | "createdAt" | "updatedAt">): ContentJob {
    const now = new Date();
    return new ContentJob({ ...input, status: "Created", createdAt: now, updatedAt: now });
  }

  /** Khoi phuc tu persistence — khong validate transition vi data da hop le. */
  static restore(props: ContentJobProps): ContentJob {
    return new ContentJob({ ...props });
  }

  transitionTo(next: ContentJobStatus): void {
    assertTransition(this.props.status, next);
    this.props.status = next;
    this.props.updatedAt = new Date();
  }

  /**
   * Trang thai cho phep sua tham so sinh bai truoc khi generate lai.
   * Dong bo voi retry (Created/Failed/DraftReady deu ve GeneratingOutline duoc —
   * content-job-state). Created duoc them (article-ai-extraction-plan.md GĐ1/GĐ4):
   * bai cam-nang khong tu queue generate luc tao, nguoi dung sua sourceContext
   * (rap tu trich xuat) truoc khi bam "Bắt đầu sinh nội dung" trong khi job con
   * dang Created.
   */
  private static readonly EDITABLE_STATUSES: readonly ContentJobStatus[] = [
    "Created",
    "Failed",
    "DraftReady",
  ];

  /**
   * Sua tham so sinh bai (topic/keyword/tone/provider/model/sourceContext) truoc
   * khi chay lai. Chi hop le o Created/Failed/DraftReady; dang generate/review/
   * approved thi tu choi. KHONG doi status — caller goi retry() de transition ve
   * GeneratingOutline va chay lai. Chi ghi de field co trong input (undefined =
   * giu nguyen).
   */
  updateGenerationParams(input: {
    topic?: string;
    keywordSeed?: string[];
    toneProfile?: string | null;
    aiProvider?: AiProviderKey;
    aiModel?: string;
    sourceContext?: string | null;
  }): void {
    if (!ContentJob.EDITABLE_STATUSES.includes(this.props.status)) {
      throw new DomainRuleError(
        `Không thể sửa job ở trạng thái ${this.props.status}`,
        [`Chỉ sửa được khi job đang ${ContentJob.EDITABLE_STATUSES.join(" hoặc ")}`],
      );
    }
    if (input.topic !== undefined) this.props.topic = input.topic;
    if (input.keywordSeed !== undefined) this.props.keywordSeed = [...input.keywordSeed];
    if (input.toneProfile !== undefined) this.props.toneProfile = input.toneProfile;
    if (input.aiProvider !== undefined) this.props.aiProvider = input.aiProvider;
    if (input.aiModel !== undefined) this.props.aiModel = input.aiModel;
    if (input.sourceContext !== undefined) this.props.sourceContext = input.sourceContext;
    this.props.updatedAt = new Date();
  }

  /** Ghi doan trich xuat gate "originality" — goi luc Approve (review-draft.usecase.ts). */
  setOriginalityExcerpt(excerpt: string): void {
    this.props.originalityExcerpt = excerpt;
    this.props.updatedAt = new Date();
  }

  /**
   * Chon/doi anh dai dien tu Thu vien anh noi dung — chi ap dung bai cam-nang
   * (article-spec SEO audit 07/2026, sua "Thumbnail luon null" luc publish).
   */
  setCoverImage(contentImageId: string | null): void {
    if (this.props.articleType !== "cam-nang") {
      throw new DomainRuleError("Chỉ bài cẩm nang mới có ảnh đại diện chọn tay ở đây");
    }
    this.props.coverImageId = contentImageId;
    this.props.updatedAt = new Date();
  }

  /** Gan danh muc bai cam nang (cam-nang-affiliate-overflow-plan.md, chot 31/07/2026). */
  setCategory(category: ArticleCategory | null): void {
    if (this.props.articleType !== "cam-nang") {
      throw new DomainRuleError("Chỉ bài cẩm nang mới có danh mục");
    }
    this.props.category = category;
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }

  get status(): ContentJobStatus {
    return this.props.status;
  }

  /** Snapshot bat bien cho persistence/serialization. */
  toSnapshot(): Readonly<ContentJobProps> {
    return { ...this.props, keywordSeed: [...this.props.keywordSeed] };
  }
}
