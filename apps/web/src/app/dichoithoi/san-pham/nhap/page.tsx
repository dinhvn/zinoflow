"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  importProductsResultSchema,
  type ImportProductRowResult,
  type ProductImportRow,
} from "@zinoflow/contracts";
import { apiSend } from "@/shared/api-client";
import { Badge, Button, ErrorBox, Input } from "@/shared/ui";
import { emptyToUndef, parseNumber, parseRowsFromText } from "@/features/dichoithoi/sheet-import-csv";

const CSV_HEADERS = ["name", "category", "tags", "thumbnailUrl", "price", "sourceUrl"] as const;

function parseTags(s: string | undefined): string[] | undefined {
  const v = emptyToUndef(s);
  if (!v) return undefined;
  const tags = v.split("|").map((t) => t.trim()).filter(Boolean);
  return tags.length ? tags : undefined;
}

function rowFromObject(o: Record<string, string>): ProductImportRow {
  return {
    name: (o.name ?? "").trim(),
    category: (o.category ?? "").trim(),
    tags: parseTags(o.tags),
    thumbnailUrl: emptyToUndef(o.thumbnailUrl) ?? null,
    price: parseNumber(o.price) ?? null,
    sourceUrl: (o.sourceUrl ?? "").trim(),
  };
}

function parseInput(text: string): ProductImportRow[] {
  return parseRowsFromText(text).map(rowFromObject);
}

const ACTION_TONE = { create: "emerald", update: "blue" } as const;
const ACTION_LABEL = { create: "Tạo mới", update: "Cập nhật" } as const;

/** Nhap hang loat San pham tu Google Sheet/CSV/JSON — chi khop theo sourceUrl (product-spec §5.1). */
export default function ImportProductsPage() {
  const [text, setText] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [items, setItems] = useState<ProductImportRow[] | null>(null);

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(await apiSend("POST", "/products/fetch-sheet", { url: sheetUrl.trim() })),
    onSuccess: (r) => {
      setText(r.csv);
      dryRun.reset();
      try {
        setItems(parseInput(r.csv));
        setParseError(null);
      } catch (e) {
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
  });

  function handleParse() {
    setParseError(null);
    dryRun.reset();
    try {
      const parsed = parseInput(text);
      const bad = parsed.findIndex((r) => !r.name.trim() || !r.category.trim() || !r.sourceUrl.trim());
      if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu tên/danh mục/link gốc (sourceUrl)`);
      if (parsed.length === 0) throw new Error("Không có dòng nào");
      setItems(parsed);
    } catch (e) {
      setItems(null);
      setParseError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleFile(file: File) {
    setText(await file.text());
    setItems(null);
    dryRun.reset();
  }

  return (
    <div className="max-w-4xl space-y-5">
      <a href="/dichoithoi/san-pham" className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách sản phẩm
      </a>
      <div>
        <h2 className="text-xl font-semibold">Nhập danh sách sản phẩm</h2>
        <p className="text-sm text-zinc-500">
          Chỉ khớp theo <strong>sourceUrl</strong> (đã có → cập nhật, chưa có → tạo mới). Không
          gộp theo tên trùng — sản phẩm không có địa lý để phân biệt.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="mb-1 block text-sm font-medium">Link Google Sheet</label>
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
        <p className="mt-2 text-xs text-zinc-500">
          Cột hỗ trợ: {CSV_HEADERS.join(", ")} (tags cách nhau dấu &quot;|&quot;)
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm"
          />
          <span className="text-xs text-zinc-500">hoặc dán trực tiếp bên dưới</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setItems(null);
            dryRun.reset();
          }}
          rows={10}
          placeholder={`CSV: ${CSV_HEADERS.join(",")}`}
          className="w-full rounded border border-zinc-300 bg-transparent p-2 font-mono text-xs dark:border-zinc-700"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" disabled={!text.trim()} onClick={handleParse}>
            Kiểm tra dữ liệu
          </Button>
          {items && (
            <Button size="sm" loading={dryRun.isPending} onClick={() => dryRun.mutate()}>
              Xem trước ({items.length} dòng)
            </Button>
          )}
        </div>
        {parseError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">⚠️ {parseError}</p>}
      </div>

      {dryRun.isError && <ErrorBox error={dryRun.error} fallback="Lỗi xem trước" />}

      {dryRun.data && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tạo mới {dryRun.data.created} · Cập nhật {dryRun.data.updated} · Lỗi {dryRun.data.errors}
          </p>
          <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
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
          <a href="/dichoithoi/san-pham" className="mt-2 block text-blue-600 hover:underline dark:text-blue-400">
            → Về danh sách sản phẩm
          </a>
        </div>
      )}
    </div>
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
