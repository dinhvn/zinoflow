import type { ImageJobDetail, ImageProps } from "@zinoflow/contracts";

/**
 * Port luu/doc job render anh — spec §10, §13. Implementation: TypeOrmImageJobRepository.
 */
export const IMAGE_JOB_REPOSITORY = Symbol("IMAGE_JOB_REPOSITORY");

export interface NewImageJob {
  id: string;
  aspect: string;
  perImage: number;
  totalItems: number;
  exportFormat: string;
  exportQuality: number;
  exportScale: number;
  items: { id: string; index: number; props: ImageProps }[];
}

export interface ImageJobItemRow {
  id: string;
  index: number;
  props: ImageProps;
}

export interface ImageJobRepository {
  create(job: NewImageJob): Promise<void>;
  setJobStatus(jobId: string, status: string, outputDir?: string): Promise<void>;
  listItems(jobId: string): Promise<ImageJobItemRow[]>;
  markItemCompleted(itemId: string, outputFile: string): Promise<void>;
  markItemFailed(itemId: string, error: string): Promise<void>;
  /** Cap nhat completedItems va status tong hop sau khi render xong batch. */
  finalizeJob(jobId: string): Promise<void>;
  getDetail(jobId: string): Promise<ImageJobDetail | null>;
}
