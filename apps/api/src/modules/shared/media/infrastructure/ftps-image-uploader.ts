import { Injectable, Logger } from "@nestjs/common";
import { Client, type AccessOptions } from "basic-ftp";
import { Readable } from "node:stream";
import path from "node:path";
import { UpstreamApiError } from "../../errors/app-error";
import type { ImageUploader, UploadFile } from "../ports/image-uploader.port";

const FTP_TIMEOUT_MS = 30_000;
const DEFAULT_BASE_DIR_ENV_VAR = "DICHOITHOI_FTP_BASE_DIR";

/** Cau hinh FTP doc tu env (DICHOITHOI_FTP_HOST/USER/PASSWORD chung + 1 BASE_DIR rieng theo module) */
interface FtpConfig extends AccessOptions {
  baseDir: string;
}

/**
 * Day anh len hosting dichoithoi qua FTPS explicit (spec §14.1.1). Dung chung
 * cho moi module co anh (diem den, khach san, tour, san pham — §14.5) — moi
 * module truyen ten bien env BASE_DIR rieng de tach thu muc goc tren hosting.
 * Moi lan upload mo 1 phien roi dong — hosting share gioi han so ket noi,
 * khong giu pool. Passive mode mac dinh (basic-ftp tu dam phan).
 */
@Injectable()
export class FtpsImageUploader implements ImageUploader {
  private readonly logger = new Logger(FtpsImageUploader.name);

  async upload(files: UploadFile[], baseDirEnvVar = DEFAULT_BASE_DIR_ENV_VAR): Promise<void> {
    if (files.length === 0) return;
    const config = this.readConfig(baseDirEnvVar);

    const client = new Client(FTP_TIMEOUT_MS);
    try {
      await client.access(config);
      for (const file of files) {
        const remote = this.joinRemote(config.baseDir, file.path);
        // ensureDir tao (va cd vao) thu muc con; sau do upload dung ten file trong do
        await client.ensureDir(path.posix.dirname(remote));
        await client.uploadFrom(Readable.from(file.body), path.posix.basename(remote));
      }
      this.logger.log(`Upload ${files.length} ảnh lên FTP xong (base ${config.baseDir})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new UpstreamApiError(`Upload ảnh lên FTP thất bại: ${message}`, [
        "Kiểm tra DICHOITHOI_FTP_* trong .env và quyền ghi thư mục ảnh",
      ]);
    } finally {
      client.close();
    }
  }

  /** Gom env -> config; nem loi ro rang neu thieu bat ky truong bat buoc nao */
  private readConfig(baseDirEnvVar: string): FtpConfig {
    const host = process.env.DICHOITHOI_FTP_HOST;
    const user = process.env.DICHOITHOI_FTP_USER;
    const password = process.env.DICHOITHOI_FTP_PASSWORD;
    const baseDir = process.env[baseDirEnvVar];
    if (!host || !user || !password || !baseDir) {
      throw new UpstreamApiError("Chưa cấu hình FTP để upload ảnh", [
        `Điền DICHOITHOI_FTP_HOST/USER/PASSWORD và ${baseDirEnvVar} trong apps/api/.env`,
      ]);
    }
    return {
      host,
      user,
      password,
      port: Number(process.env.DICHOITHOI_FTP_PORT ?? 21),
      // FTPS explicit TLS mac dinh; dat DICHOITHOI_FTP_SECURE=false neu hosting chi FTP thuong
      secure: process.env.DICHOITHOI_FTP_SECURE !== "false",
      baseDir,
    };
  }

  /** Ghep baseDir + path tuong doi bang dau "/" POSIX (FTP luon dung "/") */
  private joinRemote(baseDir: string, relativePath: string): string {
    const cleanBase = baseDir.replace(/\/+$/, "");
    const cleanPath = relativePath.replace(/^\/+/, "");
    return path.posix.join(cleanBase, cleanPath);
  }
}
