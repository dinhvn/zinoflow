import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UpstreamApiError } from "../../errors/app-error";
import type { ImageUploader, UploadFile } from "../ports/image-uploader.port";

const DEFAULT_BASE_DIR_ENV_VAR = "DICHOITHOI_FTP_BASE_DIR";

/**
 * Ghi anh thang vao repo DiChoiThoi.Web tren may (dev/test local) thay vi day
 * len FTP production. Dung CUNG bien env *_BASE_DIR voi FtpsImageUploader,
 * chi doi goc tu hosting site4now sang DICHOITHOI_LOCAL_WEB_ROOT — nho vay
 * chuyen doi provider (env IMAGE_UPLOADER_PROVIDER) khong doi logic goi noi khac.
 */
@Injectable()
export class LocalImageUploader implements ImageUploader {
  private readonly logger = new Logger(LocalImageUploader.name);

  async upload(files: UploadFile[], baseDirEnvVar = DEFAULT_BASE_DIR_ENV_VAR): Promise<void> {
    if (files.length === 0) return;

    const webRoot = process.env.DICHOITHOI_LOCAL_WEB_ROOT;
    const baseDir = process.env[baseDirEnvVar];
    if (!webRoot || !baseDir) {
      throw new UpstreamApiError("Chưa cấu hình thư mục local để ghi ảnh", [
        `Điền DICHOITHOI_LOCAL_WEB_ROOT và ${baseDirEnvVar} trong apps/api/.env`,
      ]);
    }

    try {
      for (const file of files) {
        const target = path.join(webRoot, baseDir.replace(/^[/\\]+/, ""), file.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.body);
      }
      this.logger.log(`Ghi ${files.length} ảnh vào local xong (${webRoot})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new UpstreamApiError(`Ghi ảnh vào local thất bại: ${message}`, [
        "Kiểm tra DICHOITHOI_LOCAL_WEB_ROOT và quyền ghi thư mục",
      ]);
    }
  }
}
