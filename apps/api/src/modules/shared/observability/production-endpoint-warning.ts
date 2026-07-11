import type { Logger } from "@nestjs/common";

/**
 * ZinoFlow chay local-first (khong co server dev/prod tach biet) — nhung mot
 * so tich hop ngoai (FTP anh dien den, SQL Server khuyenmai, WordPress) chua
 * co ban sandbox rieng, nen .env dev van phai tro thang toi endpoint THAT
 * (dichoithoi-implementation-plan.md Phase 0 — "vi pham DoD nghia den du
 * khong lo vao git"). Canh bao ro luc khoi dong de khong ai quen dang thao
 * tac tren du lieu that khi dang "test".
 */
interface RemoteEndpointCheck {
  label: string;
  envKey: string;
}

const REMOTE_ENDPOINT_CHECKS: readonly RemoteEndpointCheck[] = [
  { label: "FTP ảnh điểm đến (site4now)", envKey: "DICHOITHOI_FTP_HOST" },
  { label: "SQL Server khuyến mãi laruki/dochoi3s (site4now)", envKey: "KHUYENMAI_DB_HOST" },
  { label: "WordPress laruki.com", envKey: "WP_LARUKI_URL" },
  { label: "WordPress dochoi3s.com", envKey: "WP_DOCHOI3S_URL" },
  { label: "CMS sản phẩm/.NET cũ", envKey: "CMS_BASE_URL" },
];

function looksLocal(value: string): boolean {
  const v = value.toLowerCase();
  return (
    v === "" ||
    v.includes("localhost") ||
    v.includes("127.0.0.1") ||
    v.startsWith("(localdb)")
  );
}

/** Goi 1 lan luc bootstrap — chi log, khong chan khoi dong (feature van can dung duoc). */
export function warnAboutProductionEndpoints(logger: Logger): void {
  const remoteEndpoints = REMOTE_ENDPOINT_CHECKS.map((check) => ({
    ...check,
    value: process.env[check.envKey] ?? "",
  })).filter((check) => check.value && !looksLocal(check.value));

  if (remoteEndpoints.length === 0) return;

  const list = remoteEndpoints.map((c) => `${c.label} (${c.envKey})`).join(", ");
  logger.warn(
    `.env dev đang trỏ tới endpoint THẬT (chưa có sandbox riêng): ${list}. ` +
      `Thao tác liên quan (upload ảnh, publish WordPress, đọc CMS...) ảnh hưởng dữ liệu THẬT — cẩn thận khi test.`,
  );
}
