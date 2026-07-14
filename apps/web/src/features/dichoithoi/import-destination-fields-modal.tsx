"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  bulkUpdateDestinationFieldsResultSchema,
  DESTINATION_BULK_EDIT_FIELD_KEYS,
  type DestinationBulkEditRow,
} from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button, Input, Modal } from "@/shared/ui";
import { parseRowsFromText, emptyToUndef } from "./sheet-import-csv";

/** Dong CSV (Record<string,string>) -> row bulk-edit — chi giu dung 7 cot cho phep, o rong = khong doi. */
function rowFromObject(o: Record<string, string>): DestinationBulkEditRow {
  const row: DestinationBulkEditRow = { slug: (o.slug ?? "").trim() };
  for (const key of DESTINATION_BULK_EDIT_FIELD_KEYS) {
    const v = emptyToUndef(o[key]);
    if (v !== undefined) row[key] = v;
  }
  return row;
}

/**
 * Buoc 4 luong sua nhanh hang loat: dan link Google Sheet (da sua xong sau khi
 * export o buoc 1) -> khop theo slug -> GHI DE dung cot co gia tri, bo qua o
 * rong. Tai dung POST /destinations/fetch-sheet (da co san cho ImportDestinationsModal).
 */
export function ImportDestinationFieldsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [preview, setPreview] = useState<DestinationBulkEditRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(
        await apiSend("POST", "/destinations/fetch-sheet", { url: sheetUrl.trim() }),
      ),
    onSuccess: (r) => {
      updateMutation.reset();
      try {
        const rows = parseRowsFromText(r.csv).map(rowFromObject);
        const bad = rows.findIndex((x) => !x.slug);
        if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu slug`);
        if (rows.length === 0) throw new Error("Không có dòng nào");
        setParseError(null);
        setPreview(rows);
      } catch (e) {
        setPreview(null);
        setParseError(e instanceof Error ? e.message : String(e));
      }
    },
    onError: (e) =>
      setParseError(e instanceof ApiError ? e.message : "Không tải được Google Sheet"),
  });

  const updateMutation = useMutation({
    mutationFn: async (items: DestinationBulkEditRow[]) =>
      bulkUpdateDestinationFieldsResultSchema.parse(
        await apiSend("POST", "/destinations/bulk-update-fields", { items }),
      ),
    onSuccess: onImported,
  });

  function handleClose() {
    setPreview(null);
    setParseError(null);
    fetchSheet.reset();
    updateMutation.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nhập lại từ Google Sheet (sửa hàng loạt)">
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          Khớp theo <strong>slug</strong> — slug không tồn tại sẽ báo lỗi (không tạo mới). Ô nào
          <strong> có giá trị</strong> sẽ ghi đè, ô để trống giữ nguyên dữ liệu cũ.
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
        <p className="text-xs text-zinc-500">
          Cột hỗ trợ: slug, {DESTINATION_BULK_EDIT_FIELD_KEYS.join(", ")}
        </p>
        {parseError && <p className="text-sm text-red-600 dark:text-red-400">⚠️ {parseError}</p>}

        {preview && !updateMutation.data && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Đọc được <strong>{preview.length}</strong> dòng. Xem trước 5 dòng đầu:
            </p>
            <ul className="list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
              {preview.slice(0, 5).map((r, i) => (
                <li key={i}>{r.slug}</li>
              ))}
            </ul>
            <Button
              variant="primary"
              size="sm"
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate(preview)}
            >
              Cập nhật {preview.length} điểm
            </Button>
          </div>
        )}

        {updateMutation.isError && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {updateMutation.error instanceof ApiError ? updateMutation.error.message : "Cập nhật thất bại"}
          </div>
        )}

        {updateMutation.data && (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <p className="font-medium">
              ✅ Cập nhật {updateMutation.data.updated} · Lỗi {updateMutation.data.errors.length}
            </p>
            {updateMutation.data.errors.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-red-700 dark:text-red-300">
                {updateMutation.data.errors.map((e, i) => (
                  <li key={i}>
                    Dòng {e.row} ({e.slug || "—"}): {e.message}
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
