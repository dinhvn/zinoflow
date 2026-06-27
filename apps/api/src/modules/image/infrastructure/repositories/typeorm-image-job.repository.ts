import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ImageJobDetail, ImageOutput } from "@zinoflow/contracts";
import { ImageRenderJobEntity } from "../entities/image-render-job.entity";
import { ImageRenderItemEntity } from "../entities/image-render-item.entity";
import type {
  ImageJobItemRow,
  ImageJobRepository,
  NewImageJob,
} from "../../application/ports/image-job.repository";

/** Repository job render anh tren Postgres (implement port application). */
@Injectable()
export class TypeOrmImageJobRepository implements ImageJobRepository {
  constructor(
    @InjectRepository(ImageRenderJobEntity)
    private readonly jobs: Repository<ImageRenderJobEntity>,
    @InjectRepository(ImageRenderItemEntity)
    private readonly items: Repository<ImageRenderItemEntity>,
  ) {}

  async create(job: NewImageJob): Promise<void> {
    await this.jobs.insert({
      id: job.id,
      aspect: job.aspect,
      perImage: job.perImage,
      status: "Created",
      totalItems: job.totalItems,
      completedItems: 0,
      exportFormat: job.exportFormat,
      exportQuality: job.exportQuality,
      exportScale: String(job.exportScale),
      outputDir: null,
    });
    await this.items.insert(
      job.items.map((it) => ({
        id: it.id,
        jobId: job.id,
        index: it.index,
        propsJson: it.props,
        status: "Pending",
        outputFile: null,
        error: null,
      })),
    );
  }

  async setJobStatus(jobId: string, status: string, outputDir?: string): Promise<void> {
    await this.jobs.update({ id: jobId }, outputDir ? { status, outputDir } : { status });
  }

  async listItems(jobId: string): Promise<ImageJobItemRow[]> {
    const rows = await this.items.find({ where: { jobId }, order: { index: "ASC" } });
    return rows.map((r) => ({ id: r.id, index: r.index, props: r.propsJson }));
  }

  async markItemCompleted(itemId: string, outputFile: string): Promise<void> {
    await this.items.update({ id: itemId }, { status: "Completed", outputFile, error: null });
  }

  async markItemFailed(itemId: string, error: string): Promise<void> {
    await this.items.update({ id: itemId }, { status: "Failed", error });
  }

  async finalizeJob(jobId: string): Promise<void> {
    const items = await this.items.find({ where: { jobId } });
    const completed = items.filter((i) => i.status === "Completed").length;
    const anyFailed = items.some((i) => i.status === "Failed");
    const status = anyFailed && completed === 0 ? "Failed" : "Completed";
    await this.jobs.update({ id: jobId }, { completedItems: completed, status });
  }

  async getDetail(jobId: string): Promise<ImageJobDetail | null> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) return null;
    const items = await this.items.find({ where: { jobId }, order: { index: "ASC" } });
    const outputs: ImageOutput[] = items.map((i) => ({
      index: i.index,
      file: i.outputFile ?? "",
      status: i.status === "Completed" ? "Completed" : "Failed",
      error: i.error,
    }));
    return {
      jobId: job.id,
      aspect: job.aspect as ImageJobDetail["aspect"],
      status: job.status as ImageJobDetail["status"],
      totalItems: job.totalItems,
      completedItems: job.completedItems,
      outputs,
    };
  }
}
