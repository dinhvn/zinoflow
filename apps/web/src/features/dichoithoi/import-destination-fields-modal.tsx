"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  bulkUpdateDestinationFieldsResultSchema,
  DESTINATION_BULK_EDIT_FIELD_KEYS,
  DESTINATION_BULK_EDIT_FIELD_LABELS,
  type DestinationBulkEditRow,
  type DestinationBulkEditFieldKey,
} from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button, Input, Modal } from "@/shared/ui";
import { parseRowsFromText, emptyToUndef, formatValidationDetail } from "./sheet-import-csv";

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1dj2Zwb496l6rTJykOpMYLyP8syD13Bv4MFrIi9fgIpo/edit?gid=229521716#gid=229521716";

/** Dong CSV (Record<string,string>) -> row bulk-edit — chi giu cac cot cho phep, o rong = khong doi. */
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
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL);
  const [preview, setPreview] = useState<DestinationBulkEditRow[] | null>(null);
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [previewFields, setPreviewFields] = useState<DestinationBulkEditFieldKey[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(
        await apiSend("POST", "/destinations/fetch-sheet", { url: sheetUrl.trim() }),
      ),
    onSuccess: (r) => {
      updateMutation.reset();
      try {
        const raw = parseRowsFromText(r.csv);
        const sheetHeaders = new Set(raw.length ? Object.keys(raw[0]!) : []);
        const rows = raw.map(rowFromObject);
        const bad = rows.findIndex((x) => !x.slug);
        if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu slug`);
        if (rows.length === 0) throw new Error("Không có dòng nào");
        setParseError(null);
        setPreview(rows);
        // "name" chi de hien thi cho de nhan biet dong — khong nam trong
        // DESTINATION_BULK_EDIT_FIELD_KEYS nen khong bao gio duoc dung de cap nhat.
        setPreviewNames(raw.map((o) => o.name ?? ""));
        setPreviewFields(DESTINATION_BULK_EDIT_FIELD_KEYS.filter((key) => sheetHeaders.has(key)));
      } catch (e) {
        setPreview(null);
        setPreviewNames([]);
        setPreviewFields([]);
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
    setPreviewNames([]);
    setPreviewFields([]);
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
          Cột hỗ trợ: slug, name/province/parent (chỉ tham khảo, không cập nhật),{" "}
          {DESTINATION_BULK_EDIT_FIELD_KEYS.join(", ")}
        </p>
        {parseError && <p className="text-sm text-red-600 dark:text-red-400">⚠️ {parseError}</p>}

        {preview && !updateMutation.data && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Đọc được <strong>{preview.length}</strong> dòng. Kiểm tra kỹ trước khi xác nhận —
              dữ liệu <strong>chưa</strong> được ghi vào hệ thống ở bước này.
            </p>
            <div className="max-h-72 overflow-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
                  <tr>
                    <th className="px-2 py-1">Slug</th>
                    {previewNames.some((n) => n) && (
                      <th className="px-2 py-1 whitespace-nowrap">Tên (tham khảo)</th>
                    )}
                    {previewFields.map((key) => (
                      <th key={key} className="px-2 py-1 whitespace-nowrap">
                        {DESTINATION_BULK_EDIT_FIELD_LABELS[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-1">{r.slug}</td>
                      {previewNames.some((n) => n) && (
                        <td className="max-w-[16rem] truncate px-2 py-1 text-zinc-500">
                          {previewNames[i] ?? ""}
                        </td>
                      )}
                      {previewFields.map((key) => (
                        <td key={key} className="max-w-[16rem] truncate px-2 py-1 text-zinc-500">
                          {r[key] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate(preview)}
            >
              Xác nhận cập nhật {preview.length} điểm
            </Button>
          </div>
        )}

        {updateMutation.isError && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <p>
              {updateMutation.error instanceof ApiError ? updateMutation.error.message : "Cập nhật thất bại"}
            </p>
            {updateMutation.error instanceof ApiError && updateMutation.error.details.length > 0 && (
              <ul className="mt-1 list-inside list-disc">
                {updateMutation.error.details.map((d, i) => (
                  <li key={i}>{formatValidationDetail(d, preview ?? [])}</li>
                ))}
              </ul>
            )}
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
