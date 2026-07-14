"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  importDestinationTicketsResultSchema,
  type DestinationTicketImportRow,
} from "@zinoflow/contracts";
import { apiSend } from "@/shared/api-client";
import { Button, ErrorBox, Input, Modal } from "@/shared/ui";
import { emptyToUndef, parseNumber, parseRowsFromText } from "./sheet-import-csv";

const CSV_HEADERS = ["destinationSlug", "provider", "label", "sourceUrl", "price", "thumbnailUrl"] as const;

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1dj2Zwb496l6rTJykOpMYLyP8syD13Bv4MFrIi9fgIpo/edit?gid=907785069#gid=907785069";

function rowFromObject(o: Record<string, string>): DestinationTicketImportRow {
  return {
    destinationSlug: (o.destinationSlug ?? "").trim(),
    provider: (o.provider ?? "").trim(),
    label: emptyToUndef(o.label) ?? null,
    sourceUrl: (o.sourceUrl ?? "").trim(),
    price: parseNumber(o.price) ?? null,
    thumbnailUrl: emptyToUndef(o.thumbnailUrl) ?? null,
  };
}

/**
 * Modal "Nhập từ Sheet" cho Vé — CHỈ Google Sheet (không chọn file/dán trực
 * tiếp, theo quy tắc chung mọi màn import). Khớp theo destinationSlug +
 * sourceUrl, lưu thẳng không dry-run (cùng pattern import Đối tác affiliate).
 */
export function ImportTicketsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL);
  const [items, setItems] = useState<DestinationTicketImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(
        await apiSend("POST", "/destinations/fetch-sheet", { url: sheetUrl.trim() }),
      ),
    onSuccess: (r) => {
      importMutation.reset();
      try {
        const rows = parseRowsFromText(r.csv).map(rowFromObject);
        const bad = rows.findIndex((x) => !x.destinationSlug.trim() || !x.provider.trim() || !x.sourceUrl.trim());
        if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu destinationSlug, provider hoặc sourceUrl`);
        if (rows.length === 0) throw new Error("Không có dòng nào");
        setParseError(null);
        setItems(rows);
      } catch (e) {
        setItems(null);
        setParseError(e instanceof Error ? e.message : String(e));
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: async () =>
      importDestinationTicketsResultSchema.parse(await apiSend("POST", "/tickets/import", { items })),
    onSuccess: onImported,
  });

  function handleClose() {
    setItems(null);
    setParseError(null);
    fetchSheet.reset();
    importMutation.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nhập vé từ Google Sheet">
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          Khớp theo <strong>destinationSlug + sourceUrl</strong> (đã có → cập nhật, chưa có → tạo
          mới). <strong>destinationSlug</strong> phải khớp đúng slug điểm đến đã có.{" "}
          <strong>provider</strong> phải khớp code 1 đối tác đang bật ở mục Affiliate.
        </p>

        <div className="flex gap-2">
          <Input
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            className="flex-1"
          />
          <Button
            variant="primary"
            className="whitespace-nowrap"
            loading={fetchSheet.isPending}
            disabled={!sheetUrl.trim()}
            onClick={() => sheetUrl.trim() && fetchSheet.mutate()}
          >
            Tải từ Sheet
          </Button>
        </div>
        <p className="text-xs text-zinc-500">Cột hỗ trợ: {CSV_HEADERS.join(", ")}</p>
        {parseError && <p className="text-sm text-red-600 dark:text-red-400">⚠️ {parseError}</p>}

        {items && !importMutation.data && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Đọc được {items.length} dòng.</p>
            <Button
              variant="primary"
              loading={importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              Lưu thẳng ({items.length} dòng)
            </Button>
          </div>
        )}

        {importMutation.isError && <ErrorBox error={importMutation.error} fallback="Lỗi nhập dữ liệu" />}

        {importMutation.data && (
          <div className="space-y-2 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <p>
              ✅ Tạo mới {importMutation.data.created} · Cập nhật {importMutation.data.updated} · Lỗi{" "}
              {importMutation.data.errors.length}
            </p>
            {importMutation.data.errors.length > 0 && (
              <ul className="space-y-1 text-xs text-red-700 dark:text-red-400">
                {importMutation.data.errors.map((e, i) => (
                  <li key={i}>
                    Dòng {e.row} ({e.destinationSlug}): {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
