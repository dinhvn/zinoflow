import type { ContentSection } from "@zinoflow/contracts";
import type { OutlineLike } from "../services/article-type-profiles";

/**
 * Port persistence cho tien do generate DANG DO cua 1 job — cho phep resume
 * (tiep tuc tu section da dung) thay vi chay lai tu dau khi worker chet giua
 * chung. Xem generate-content.usecase.ts (buoc 1/2/3).
 */
export const CONTENT_GENERATION_CHECKPOINT_REPOSITORY = Symbol(
  "CONTENT_GENERATION_CHECKPOINT_REPOSITORY",
);

export interface GenerationCheckpoint {
  jobId: string;
  outline: (OutlineLike & Record<string, unknown>) | null;
  sections: ContentSection[];
}

export interface ContentGenerationCheckpointRepository {
  findByJobId(jobId: string): Promise<GenerationCheckpoint | null>;
  /** Upsert toan bo checkpoint (goi lai sau moi buoc xong — outline, tung section). */
  save(checkpoint: GenerationCheckpoint): Promise<void>;
  /** Xoa khi job xong (DraftReady) hoac tham so sinh bai bi sua (outline cu het dung). */
  clear(jobId: string): Promise<void>;
}
