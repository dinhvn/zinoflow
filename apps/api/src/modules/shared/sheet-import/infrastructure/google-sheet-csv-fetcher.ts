import { Injectable, Logger } from "@nestjs/common";
import { UpstreamApiError } from "../../errors/app-error";
import type { SheetCsvFetcher } from "../ports/sheet-csv-fetcher.port";

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Tai Google Sheet ve CSV qua endpoint gviz (khong can API key) — hoat dong khi
 * sheet duoc chia se "Bat ky ai co duong lien ket: Nguoi xem". Server fetch thay
 * client de tranh CORS. Chi chap nhan host docs.google.com (chong SSRF).
 */
@Injectable()
export class GoogleSheetCsvFetcher implements SheetCsvFetcher {
  private readonly logger = new Logger(GoogleSheetCsvFetcher.name);

  async fetchCsv(rawUrl: string): Promise<string> {
    const exportUrl = this.buildExportUrl(rawUrl);
    let response: Response;
    try {
      response = await fetch(exportUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
        headers: { accept: "text/csv,text/plain" },
      });
    } catch (err) {
      throw new UpstreamApiError(
        `Không tải được Google Sheet: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const body = await response.text();
    // Sheet chua cong khai -> Google tra ve trang HTML dang nhap thay vi CSV
    if (!response.ok || /^\s*<(?:!doctype|html)/i.test(body)) {
      throw new UpstreamApiError(
        "Không đọc được Google Sheet — hãy đặt chia sẻ 'Bất kỳ ai có đường liên kết: Người xem' rồi thử lại.",
        ["Mở Sheet > Chia sẻ > Quyền truy cập chung > Bất kỳ ai có đường liên kết"],
      );
    }
    this.logger.log(`Tai Google Sheet OK (${body.length} ky tu CSV)`);
    return body;
  }

  /**
   * Tu URL Sheet bat ky -> URL export CSV qua gviz.
   * Ho tro: .../spreadsheets/d/{id}/edit#gid={gid}, .../d/{id}/..., kem ?gid= / #gid=.
   */
  private buildExportUrl(rawUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new UpstreamApiError(`Link Google Sheet không hợp lệ: ${rawUrl}`);
    }
    if (parsed.hostname !== "docs.google.com") {
      throw new UpstreamApiError("Chỉ hỗ trợ link docs.google.com (Google Sheets)");
    }
    const idMatch = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(parsed.pathname);
    if (!idMatch) {
      throw new UpstreamApiError(
        "Không tìm thấy mã bảng tính trong link — dán link dạng .../spreadsheets/d/.../edit",
      );
    }
    const id = idMatch[1];
    const gid =
      /[?&#]gid=(\d+)/.exec(parsed.hash + parsed.search)?.[1] ??
      /[?&]gid=(\d+)/.exec(rawUrl)?.[1] ??
      "0";
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }
}
