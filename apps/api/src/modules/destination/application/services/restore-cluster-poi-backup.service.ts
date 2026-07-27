import { Inject, Injectable, Logger } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  CLUSTER_POI_BACKUP_REPOSITORY,
  type ClusterPoiBackupRepository,
} from "../ports/cluster-poi-backup.repository";
import { IMAGE_UPLOADER, type ImageUploader, type UploadFile } from "../../../shared/media/ports/image-uploader.port";
import { slugifyVietnamese } from "../../../shared/text/vietnamese";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};
function guessContentType(filePath: string): string {
  return CONTENT_TYPE_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Logic KHOI PHUC dung chung 1 dong tu bang tam dichoithoi_destinations_backup
 * thanh 1 diem den moi (dot lam moi du lieu theo Atlas — GD6 plan-lam-moi-du-lieu-atlas.md)
 * — dung boi CA 2 luong: AcceptClusterPoiCandidatesUseCase (khoi phuc qua bang
 * duyet AI, matchType="backup-match") va RestoreClusterPoiBackupUseCase (khoi
 * phuc TAY tu man "Backup còn lại", GD7 — khong qua AI, nguoi dung tu chon cum).
 */
@Injectable()
export class RestoreClusterPoiBackupService {
  private readonly logger = new Logger(RestoreClusterPoiBackupService.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(CLUSTER_POI_BACKUP_REPOSITORY)
    private readonly backupRepo: ClusterPoiBackupRepository,
    @Inject(IMAGE_UPLOADER) private readonly imageUploader: ImageUploader,
  ) {}

  /** Tra ve slug moi neu thanh cong, null neu backup khong ton tai hoac da khoi phuc roi. */
  async execute(
    backupSlug: string,
    targetClusterSlug: string,
    override?: { name?: string; shortDescription?: string | null; priority?: number },
  ): Promise<string | null> {
    const backup = await this.backupRepo.findBySlug(backupSlug);
    if (!backup || backup.restoredToSlug !== null) return null;

    const name = override?.name ?? backup.name;
    const shortDescription = override?.shortDescription ?? backup.shortDescription;
    const priority = override?.priority ?? backup.priority;
    const newSlug = await this.generateUniqueSlug(name);

    await this.mirrorRepo.restoreFromBackup(newSlug, backup, targetClusterSlug, {
      name,
      shortDescription,
      priority,
    });
    await this.copyBackupImages(backup.slug, newSlug, backup.thumbnail, backup.gallery.map((g) => g.path));
    await this.backupRepo.markRestored(backup.slug, newSlug);
    this.logger.log(`Khôi phục backup "${backup.slug}" -> "${newSlug}" (cụm ${targetClusterSlug})`);
    return newSlug;
  }

  private async copyBackupImages(
    oldSlug: string,
    newSlug: string,
    thumbnail: string | null,
    galleryPaths: string[],
  ): Promise<void> {
    const backupDir = process.env.DICHOITHOI_ATLAS_BACKUP_IMAGE_DIR;
    if (!backupDir) {
      this.logger.warn(
        "Thiếu DICHOITHOI_ATLAS_BACKUP_IMAGE_DIR trong .env — bỏ qua khôi phục ảnh (chỉ khôi phục dữ liệu)",
      );
      return;
    }
    const oldPaths = [...new Set([thumbnail, ...galleryPaths].filter((p): p is string => Boolean(p)))];
    if (oldPaths.length === 0) return;

    const files: UploadFile[] = [];
    for (const oldPath of oldPaths) {
      const absSource = path.join(backupDir, oldPath);
      try {
        const body = await readFile(absSource);
        const newPath = oldPath.replace(oldSlug, newSlug);
        files.push({ path: newPath, body, contentType: guessContentType(oldPath) });
      } catch (err) {
        this.logger.warn(`Không đọc được ảnh backup "${absSource}": ${err instanceof Error ? err.message : err}`);
      }
    }
    if (files.length === 0) return;
    try {
      await this.imageUploader.upload(files);
    } catch (err) {
      this.logger.warn(`Upload ảnh khôi phục thất bại cho "${newSlug}": ${err instanceof Error ? err.message : err}`);
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugifyVietnamese(name);
    let slug = base;
    let attempt = 2;
    while (await this.mirrorRepo.findBySlug(slug)) {
      const suffix = `-${attempt}`;
      slug = `${base.slice(0, 64 - suffix.length)}${suffix}`;
      attempt++;
    }
    return slug;
  }
}
