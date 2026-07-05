import type {
  AiProviderKey,
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
   * Dong bo voi retry (chi Failed/DraftReady moi ve GeneratingOutline duoc — content-job-state).
   */
  private static readonly EDITABLE_STATUSES: readonly ContentJobStatus[] = ["Failed", "DraftReady"];

  /**
   * Sua tham so sinh bai (topic/keyword/tone/provider/model) truoc khi chay lai.
   * Chi hop le o Failed hoac DraftReady; dang generate/review/approved thi tu choi.
   * KHONG doi status — caller goi retry() de transition ve GeneratingOutline va chay lai.
   * Chi ghi de field co trong input (undefined = giu nguyen).
   */
  updateGenerationParams(input: {
    topic?: string;
    keywordSeed?: string[];
    toneProfile?: string | null;
    aiProvider?: AiProviderKey;
    aiModel?: string;
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
