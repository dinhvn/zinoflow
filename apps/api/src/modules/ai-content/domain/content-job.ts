import type { AiProviderKey, ContentJobStatus, ContentSourceType } from "@zinoflow/contracts";
import { assertTransition } from "./content-job-state";

export interface ContentJobProps {
  id: string;
  siteCode: string;
  sourceType: ContentSourceType;
  sourceRef: string;
  topic: string;
  keywordSeed: string[];
  toneProfile: string | null;
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
