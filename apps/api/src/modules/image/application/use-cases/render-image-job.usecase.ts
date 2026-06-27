import { Inject, Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ExportOptions } from "@zinoflow/contracts";
import { IMAGE_JOB_REPOSITORY, type ImageJobRepository } from "../ports/image-job.repository";
import { IMAGE_RENDERER, type ImageRenderer } from "../ports/image-renderer.port";

/**
 * Render toan bo anh cua 1 job (spec §8, §9). Worker goi use case nay.
 * Anh loi -> mark item Failed va tiep tuc (khong fail ca batch — spec §19/§12).
 * Cuoi cung ghi manifest.json + cap nhat status tong hop.
 */
@Injectable()
export class RenderImageJobUseCase {
  private readonly logger = new Logger(RenderImageJobUseCase.name);

  constructor(
    @Inject(IMAGE_JOB_REPOSITORY) private readonly repo: ImageJobRepository,
    @Inject(IMAGE_RENDERER) private readonly renderer: ImageRenderer,
  ) {}

  async execute(jobId: string, exportOptions: ExportOptions): Promise<void> {
    const items = await this.repo.listItems(jobId);
    if (items.length === 0) return;

    await this.repo.setJobStatus(jobId, "Rendering");
    const outputDir = this.buildOutputDir(jobId);
    await mkdir(outputDir, { recursive: true });

    const ext = exportOptions.format === "png" ? "png" : "jpg";
    const manifestFiles: { index: number; file: string; status: string; error: string | null }[] = [];

    for (const item of items) {
      const slug = slugify(item.props.products[0]?.name ?? "collage");
      const fileName = `${item.props.templateId}-${item.index}-${slug}-${Date.now()}.${ext}`;
      const outputFile = join(outputDir, fileName);
      try {
        await this.renderer.renderStill(item.props, {
          outputFile,
          format: exportOptions.format,
          quality: exportOptions.quality,
          scale: exportOptions.scale,
        });
        await this.repo.markItemCompleted(item.id, outputFile);
        manifestFiles.push({ index: item.index, file: outputFile, status: "Completed", error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Render anh ${item.index} job ${jobId} loi: ${message}`);
        await this.repo.markItemFailed(item.id, message);
        manifestFiles.push({ index: item.index, file: "", status: "Failed", error: message });
      }
    }

    await writeFile(
      join(outputDir, "manifest.json"),
      JSON.stringify(
        { jobId, generatedAt: new Date().toISOString(), exportOptions, files: manifestFiles },
        null,
        2,
      ),
      "utf8",
    );

    await this.repo.setJobStatus(jobId, "Rendering", outputDir);
    await this.repo.finalizeJob(jobId);
    this.logger.log(`Job ${jobId} render xong -> ${outputDir}`);
  }

  /** ./outputs/images/{yyyy}/{MM}/{dd}/{jobId}/ (spec §10). */
  private buildOutputDir(jobId: string): string {
    const base = process.env.IMAGE_OUTPUT_DIR ?? "./outputs/images";
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return resolve(base, yyyy, mm, dd, jobId);
  }
}

/** Slug an toan cho ten file (bo dau, chi a-z0-9-). */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "collage";
}
