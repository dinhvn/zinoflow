/**
 * GD9 — Don dep backup SAU KHI dot lam moi du lieu theo Atlas hoan tat
 * (plan-lam-moi-du-lieu-atlas.md GD9).
 *
 * ⚠️ CHI CHAY KHI NGUOI DUNG DA XAC NHAN — dieu kien tien quyet (script tu kiem
 * tra, DUNG neu chua dat):
 * 1. Man "Backup còn lại" (/dichoithoi/backup-con-lai) phai VE 0 dong (moi dong
 *    backup da khoi phuc vao 1 cum HOAC nguoi dung da bam "Bo han" co ghi ly do).
 * 2. Nguoi dung da tu kiem tra du lieu moi on dinh (khong chi tin script).
 *
 * Lam 3 viec, THEO THU TU, dung lai ngay neu buoc nao that bai:
 * 1. DROP TABLE dichoithoi_destinations_backup.
 * 2. Xoa thu muc anh backup tam (DICHOITHOI_ATLAS_BACKUP_IMAGE_DIR).
 * 3. Xoa anh MO COI trong web root — CHI xoa thu muc con ung voi slug DA "Bo han"
 *    (co restore_note, KHONG co restored_to_slug) — anh cua slug da khoi phuc
 *    (restored_to_slug != null) van dang duoc website dung, KHONG DUOC DONG.
 *
 * pg_dump/.bak (D:\Gits\mmo\...-backup-atlas-2026-07-27.*) KHONG bi script nay
 * dong tram — giu lai toi sau release theo khuyen nghi trong plan, tu xoa tay.
 *
 * Chay: npx ts-node scripts/atlas-cleanup-backup.ts --yes
 */
import "dotenv/config";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require("pg") as {
  Client: new (config: { connectionString?: string }) => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, string>>; rowCount: number | null }>;
  };
};

const BACKUP_TABLE = "dichoithoi_destinations_backup";

async function main(): Promise<void> {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Day la thao tac DON DEP CUOI CUNG cua dot lam moi du lieu — CHI chay khi nguoi dung da xac nhan man " +
        '"Backup còn lại" ve 0 dong. Chay lai kem --yes de xac nhan.',
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const exists = await client.query(
      `SELECT count(*) AS c FROM information_schema.tables WHERE table_name = $1`,
      [BACKUP_TABLE],
    );
    if (exists.rows[0]?.c === "0") {
      console.log(`Bang ${BACKUP_TABLE} khong con ton tai — co the da don truoc do. Dung.`);
      return;
    }

    const remaining = await client.query(
      `SELECT count(*) AS c FROM ${BACKUP_TABLE} WHERE restored_to_slug IS NULL AND restore_note IS NULL`,
    );
    const remainingCount = Number(remaining.rows[0]?.c ?? 0);
    if (remainingCount > 0) {
      console.error(
        `DUNG: còn ${remainingCount} dòng backup CHƯA xử lý (chưa khôi phục, chưa "Bỏ hẳn") — ` +
          `xem /dichoithoi/backup-con-lai và xử lý hết trước khi dọn.`,
      );
      process.exit(1);
    }

    // Lay danh sach slug "Bo han" (can xoa anh mo coi) TRUOC khi drop bang
    const skipped = await client.query(
      `SELECT slug FROM ${BACKUP_TABLE} WHERE restored_to_slug IS NULL AND restore_note IS NOT NULL`,
    );
    const skippedSlugs = skipped.rows.map((r) => r.slug).filter((s): s is string => Boolean(s));

    console.log(`[1/3] DROP TABLE ${BACKUP_TABLE}...`);
    await client.query(`DROP TABLE ${BACKUP_TABLE}`);
    console.log("      Xong.");

    console.log("[2/3] Xoá thư mục ảnh backup tạm...");
    const imgBackupDir = process.env.DICHOITHOI_ATLAS_BACKUP_IMAGE_DIR;
    if (imgBackupDir && existsSync(imgBackupDir)) {
      rmSync(imgBackupDir, { recursive: true, force: true });
      console.log(`      Đã xoá ${imgBackupDir}`);
    } else {
      console.log("      Không tìm thấy (có thể đã xoá trước đó) — bỏ qua.");
    }

    console.log(`[3/3] Xoá ảnh mồ côi của ${skippedSlugs.length} slug đã "Bỏ hẳn"...`);
    const webRoot = process.env.DICHOITHOI_LOCAL_WEB_ROOT;
    const baseDir = process.env.DICHOITHOI_FTP_BASE_DIR;
    if (webRoot && baseDir) {
      const contentRoot = path.join(webRoot, baseDir.replace(/^[/\\]+/, ""));
      for (const slug of skippedSlugs) {
        const dir = path.join(contentRoot, slug);
        if (existsSync(dir)) {
          rmSync(dir, { recursive: true, force: true });
          console.log(`      Đã xoá ${dir}`);
        }
      }
      // File phang top-level dang "<slug>.webp" (khac layout thu-muc-theo-slug cu)
      for (const slug of skippedSlugs) {
        const flatFile = path.join(contentRoot, `${slug}.webp`);
        if (existsSync(flatFile)) {
          rmSync(flatFile, { force: true });
          console.log(`      Đã xoá ${flatFile}`);
        }
      }
    } else {
      console.log("      Thiếu DICHOITHOI_LOCAL_WEB_ROOT/DICHOITHOI_FTP_BASE_DIR — bỏ qua.");
    }

    console.log("\n=== GD9 DỌN DẸP XONG ===");
    console.log("Lưu ý: pg_dump/.bak KHÔNG bị xoá — tự dọn tay sau khi release ổn định.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Dọn dẹp THẤT BẠI:", err);
  process.exit(1);
});
