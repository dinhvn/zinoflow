"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  importDestinationsResultSchema,
  type DestinationImportRow,
} from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button, Input, Modal } from "@/shared/ui";
import { parseRowsFromText } from "./sheet-import-csv";

const CSV_HEADERS = [
  "name",
  "slug",
  "kind",
  "provinceCode",
  "parentSlug",
  "shortDescription",
  "thumbnail",
  "googleMapsUrl",
  "addressNew",
  "addressOld",
  "contactPhone",
  "contactWebsite",
  "hotelGroupId",
  "isFeatured",
  "aiNotes",
  "referenceUrls",
] as const;

function emptyToUndef(s: string | undefined): string | undefined {
  return s && s.trim() !== "" ? s.trim() : undefined;
}

/** "Giá vé=https://a|Giờ=https://b" -> [{label,url}] */
function parseRefUrls(s: string | undefined): DestinationImportRow["referenceUrls"] {
  if (!s?.trim()) return undefined;
  const list = s
    .split("|")
    .map((part) => {
      const [label, ...rest] = part.split("=");
      const url = rest.join("=").trim();
      return { label: (label ?? "").trim(), url };
    })
    .filter((r) => r.label && r.url);
  return list.length ? list : undefined;
}

function rowFromObject(o: Record<string, string>): DestinationImportRow {
  const bool = (s: string | undefined) => {
    const v = emptyToUndef(s)?.toLowerCase();
    return v === undefined ? undefined : v === "true" || v === "1" || v === "yes" || v === "có";
  };
  const kindRaw = emptyToUndef(o.kind);
  return {
    name: (o.name ?? "").trim(),
    slug: emptyToUndef(o.slug),
    kind: kindRaw === "province" || kindRaw === "cluster" ? kindRaw : "poi",
    provinceCode: emptyToUndef(o.provinceCode),
    parentSlug: emptyToUndef(o.parentSlug),
    shortDescription: emptyToUndef(o.shortDescription),
    thumbnail: emptyToUndef(o.thumbnail),
    googleMapsUrl: emptyToUndef(o.googleMapsUrl),
    addressNew: emptyToUndef(o.addressNew),
    addressOld: emptyToUndef(o.addressOld),
    contactPhone: emptyToUndef(o.contactPhone),
    contactWebsite: emptyToUndef(o.contactWebsite),
    hotelGroupId: emptyToUndef(o.hotelGroupId),
    isFeatured: bool(o.isFeatured),
    aiNotes: emptyToUndef(o.aiNotes),
    referenceUrls: parseRefUrls(o.referenceUrls),
  };
}

/**
 * Modal "Nhập từ Sheet" cho Điểm đến — CHỈ Google Sheet (không chọn file/dán
 * trực tiếp). Khớp theo slug (thiếu thì tự sinh từ tên) — UPSERT, không wipe
 * (spec §7.2).
 */
export function ImportDestinationsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [preview, setPreview] = useState<DestinationImportRow[] | null>(null);
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
        const bad = rows.findIndex((x) => !x.name.trim());
        if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu tên điểm đến`);
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

  const importMutation = useMutation({
    mutationFn: async (items: DestinationImportRow[]) =>
      importDestinationsResultSchema.parse(
        await apiSend("POST", "/destinations/import", { items }),
      ),
    onSuccess: onImported,
  });

  function handleClose() {
    setPreview(null);
    setParseError(null);
    fetchSheet.reset();
    importMutation.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nhập điểm đến từ Google Sheet">
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          Khớp theo <strong>slug</strong> (thiếu thì tự sinh từ tên): slug đã có → cập nhật, chưa có
          → tạo mới. Không bao giờ xoá dữ liệu cũ.
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

        {preview && !importMutation.data && (
          <div className="space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Đọc được <strong>{preview.length}</strong> dòng. Kiểm tra kỹ trước khi xác nhận —
              dữ liệu <strong>chưa</strong> được ghi vào hệ thống ở bước này.
            </p>
            <div className="max-h-72 overflow-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
                  <tr>
                    <th className="px-2 py-1">Tên</th>
                    <th className="px-2 py-1">Slug</th>
                    <th className="px-2 py-1">Tỉnh</th>
                    <th className="px-2 py-1">Loại</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.slug || "(tự sinh)"}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.provinceCode ?? "—"}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.kind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={importMutation.isPending}
              onClick={() => importMutation.mutate(preview)}
            >
              Xác nhận nhập {preview.length} điểm
            </Button>
          </div>
        )}

        {importMutation.isError && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {importMutation.error instanceof ApiError ? importMutation.error.message : "Nhập thất bại"}
          </div>
        )}

        {importMutation.data && (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <p className="font-medium">
              ✅ Tạo mới {importMutation.data.created} · Cập nhật {importMutation.data.updated} · Lỗi{" "}
              {importMutation.data.errors.length}
            </p>
            {importMutation.data.errors.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-red-700 dark:text-red-300">
                {importMutation.data.errors.map((e, i) => (
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
