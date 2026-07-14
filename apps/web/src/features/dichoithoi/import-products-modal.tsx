"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  importProductsResultSchema,
  PRODUCT_CATEGORIES,
  type ImportProductRowResult,
  type ProductImportRow,
} from "@zinoflow/contracts";
import { apiSend } from "@/shared/api-client";
import { Badge, Button, ErrorBox, Input, Modal } from "@/shared/ui";
import { emptyToUndef, parseNumber, parseRowsFromText } from "./sheet-import-csv";

const CSV_HEADERS = ["name", "category", "tags", "thumbnailUrl", "price", "sourceUrl"] as const;

function parseTags(s: string | undefined): string[] | undefined {
  const v = emptyToUndef(s);
  if (!v) return undefined;
  const tags = v.split("|").map((t) => t.trim()).filter(Boolean);
  return tags.length ? tags : undefined;
}

function isKnownCategory(value: string): value is (typeof PRODUCT_CATEGORIES)[number] {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

function rowFromObject(o: Record<string, string>): ProductImportRow {
  const category = (o.category ?? "").trim();
  return {
    name: (o.name ?? "").trim(),
    category: category as ProductImportRow["category"],
    tags: parseTags(o.tags),
    thumbnailUrl: emptyToUndef(o.thumbnailUrl) ?? null,
    price: parseNumber(o.price) ?? null,
    sourceUrl: (o.sourceUrl ?? "").trim(),
  };
}

const ACTION_TONE = { create: "emerald", update: "blue" } as const;
const ACTION_LABEL = { create: "Tạo mới", update: "Cập nhật" } as const;

/**
 * Modal "Nhập từ Sheet" cho Sản phẩm — CHỈ Google Sheet (không chọn file/dán
 * trực tiếp). Chỉ khớp theo sourceUrl (product-spec §5.1) — dry-run xem trước
 * rồi ghi thật.
 */
export function ImportProductsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [items, setItems] = useState<ProductImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(await apiSend("POST", "/products/fetch-sheet", { url: sheetUrl.trim() })),
    onSuccess: (r) => {
      dryRun.reset();
      try {
        const rows = parseRowsFromText(r.csv).map(rowFromObject);
        const bad = rows.findIndex((x) => !x.name.trim() || !x.category.trim() || !x.sourceUrl.trim());
        if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu tên/danh mục/link gốc (sourceUrl)`);
        const badCategory = rows.findIndex((x) => !isKnownCategory(x.category));
        if (badCategory >= 0) {
          throw new Error(
            `Dòng ${badCategory + 1}: category "${rows[badCategory]!.category}" không hợp lệ — ` +
              `phải là 1 trong: ${PRODUCT_CATEGORIES.join(", ")}`,
          );
        }
        if (rows.length === 0) throw new Error("Không có dòng nào");
        setParseError(null);
        setItems(rows);
      } catch (e) {
        setItems(null);
        setParseError(e instanceof Error ? e.message : String(e));
      }
    },
  });

  const dryRun = useMutation({
    mutationFn: async () =>
      importProductsResultSchema.parse(await apiSend("POST", "/products/import", { items, dryRun: true })),
  });

  const apply = useMutation({
    mutationFn: async () =>
      importProductsResultSchema.parse(
        await apiSend("POST", "/products/import", { items, dryRun: false }),
      ),
    onSuccess: onImported,
  });

  function handleClose() {
    setItems(null);
    setParseError(null);
    fetchSheet.reset();
    dryRun.reset();
    apply.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nhập sản phẩm từ Google Sheet">
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          Chỉ khớp theo <strong>sourceUrl</strong> (đã có → cập nhật, chưa có → tạo mới). Không gộp
          theo tên trùng — sản phẩm không có địa lý để phân biệt.
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
          Cột hỗ trợ: {CSV_HEADERS.join(", ")} (tags cách nhau dấu &quot;|&quot;)
        </p>
        {parseError && <p className="text-sm text-red-600 dark:text-red-400">⚠️ {parseError}</p>}

        {items && !dryRun.data && (
          <Button size="sm" loading={dryRun.isPending} onClick={() => dryRun.mutate()}>
            Xem trước ({items.length} dòng)
          </Button>
        )}

        {dryRun.isError && <ErrorBox error={dryRun.error} fallback="Lỗi xem trước" />}

        {dryRun.data && !apply.data && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tạo mới {dryRun.data.created} · Cập nhật {dryRun.data.updated} · Lỗi {dryRun.data.errors}
            </p>
            <div className="max-h-64 divide-y divide-zinc-200 overflow-y-auto rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {dryRun.data.rows.map((r, i) => (
                <RowPreview key={i} row={r} />
              ))}
            </div>
            <Button variant="primary" loading={apply.isPending} onClick={() => apply.mutate()}>
              Ghi thật
            </Button>
          </div>
        )}

        {apply.isError && <ErrorBox error={apply.error} fallback="Lỗi ghi dữ liệu" />}

        {apply.data && (
          <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            ✅ Tạo mới {apply.data.created} · Cập nhật {apply.data.updated} · Lỗi {apply.data.errors}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RowPreview({ row }: { row: ImportProductRowResult }) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
      <Badge tone={ACTION_TONE[row.action]}>{ACTION_LABEL[row.action]}</Badge>
      <span className="font-medium">{row.name}</span>
      <span className="text-xs text-zinc-500">{row.sourceUrl}</span>
      {row.error && <span className="text-xs text-red-600 dark:text-red-400">— {row.error}</span>}
    </div>
  );
}
