"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  destinationTaxonomySchema,
  fetchSheetResponseSchema,
  importDestinationsResultSchema,
  type DestinationImportRow,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button, Input, Modal } from "@/shared/ui";
import { parseRowsFromText, formatValidationDetail, resolveProvinceCode } from "./sheet-import-csv";

const DEFAULT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1dj2Zwb496l6rTJykOpMYLyP8syD13Bv4MFrIi9fgIpo/edit?gid=1621981463#gid=1621981463";

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
  "priority",
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

function rowFromObject(
  o: Record<string, string>,
  provinces: ReadonlyArray<{ provinceCode: string; name: string; shortName: string }>,
): DestinationImportRow {
  // Do uu tien 1-5 (1=cao nhat) — thay isFeatured cu (relations-plan §1.1). Gia tri
  // ngoai khoang hoac khong hop le -> undefined, server tu mac dinh 3.
  const priority = (s: string | undefined) => {
    const n = Number(emptyToUndef(s));
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
  };
  const kindRaw = emptyToUndef(o.kind);
  return {
    name: (o.name ?? "").trim(),
    slug: emptyToUndef(o.slug),
    kind: kindRaw === "province" || kindRaw === "cluster" ? kindRaw : "poi",
    provinceCode: resolveProvinceCode(o.provinceCode, provinces),
    parentSlug: emptyToUndef(o.parentSlug),
    shortDescription: emptyToUndef(o.shortDescription),
    thumbnail: emptyToUndef(o.thumbnail),
    googleMapsUrl: emptyToUndef(o.googleMapsUrl),
    addressNew: emptyToUndef(o.addressNew),
    addressOld: emptyToUndef(o.addressOld),
    contactPhone: emptyToUndef(o.contactPhone),
    contactWebsite: emptyToUndef(o.contactWebsite),
    hotelGroupId: emptyToUndef(o.hotelGroupId),
    priority: priority(o.priority),
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
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_SHEET_URL);
  const [preview, setPreview] = useState<DestinationImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Cung queryKey voi trang danh sach (page.tsx) nen React Query dung chung
  // cache, khong goi API taxonomy them lan nao — chi de resolve ten tinh -> ma.
  const taxonomyQuery = useQuery({
    queryKey: ["dichoithoi-taxonomy"],
    queryFn: () => apiGet("/destinations/taxonomy", destinationTaxonomySchema),
    staleTime: 5 * 60 * 1000,
  });

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(
        await apiSend("POST", "/destinations/fetch-sheet", { url: sheetUrl.trim() }),
      ),
    onSuccess: (r) => {
      importMutation.reset();
      try {
        const provinces = taxonomyQuery.data?.provinces ?? [];
        const rows = parseRowsFromText(r.csv).map((o) => rowFromObject(o, provinces));
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
        <p className="text-xs text-zinc-500">
          <strong>provinceCode</strong>: có thể gõ mã số (vd 68) hoặc tên tỉnh/thành (vd "Lâm Đồng",
          "lam-dong") — hệ thống tự tra ra mã tương ứng.
        </p>
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
                    <th className="px-2 py-1">Cha (parentSlug)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.slug || "(tự sinh)"}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.provinceCode ?? "—"}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.kind}</td>
                      <td className="px-2 py-1 text-zinc-500">{r.parentSlug ?? "—"}</td>
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
            <p>
              {importMutation.error instanceof ApiError ? importMutation.error.message : "Nhập thất bại"}
            </p>
            {importMutation.error instanceof ApiError && importMutation.error.details.length > 0 && (
              <ul className="mt-1 list-inside list-disc">
                {importMutation.error.details.map((d, i) => (
                  <li key={i}>{formatValidationDetail(d, preview ?? [])}</li>
                ))}
              </ul>
            )}
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
