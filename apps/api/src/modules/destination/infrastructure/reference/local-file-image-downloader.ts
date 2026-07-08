import { Injectable, Logger } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImageDownloader } from "../../application/ports/image-downloader.port";

/**
 * Doc anh layout cu thang tu thu muc local (repo DiChoiThoi.Web chay cung may
 * voi zinoflow — local-first). Tranh phu thuoc URL live: layout/duoi file thuc
 * te tren hosting co the khac voi quy uoc cu ("{slug}.webp").
 */
@Injectable()
export class LocalFileImageDownloader implements ImageDownloader {
  private readonly logger = new Logger(LocalFileImageDownloader.name);

  async download(relativePath: string): Promise<Buffer | null> {
    const baseDir = process.env.DICHOITHOI_LOCAL_DIEM_DEN_DIR;
    if (!baseDir) {
      this.logger.warn("Chua cau hinh DICHOITHOI_LOCAL_DIEM_DEN_DIR");
      return null;
    }
    const filePath = join(baseDir, relativePath);
    try {
      return await readFile(filePath);
    } catch (err) {
      this.logger.warn(`Doc file anh loi (${filePath}): ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
