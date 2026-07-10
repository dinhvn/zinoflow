"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  importToursResultSchema,
  type ImportTourRowResult,
  type TourImportRow,
} from "@zinoflow/contracts";
import { apiSend } from "@/shared/api-client";
import { Badge, Button, Checkbox, ErrorBox, Input } from "@/shared/ui";
import { emptyToUndef, parseNumber, parseRowsFromText } from "@/features/dichoithoi/sheet-import-csv";

const CSV_HEADERS = [
  "name",
  "shortDescription",
  "durationDays",
  "durationNights",
  "departureFrom",
  "provinceCode",
  "priceFrom",
  "rating",
  "reviewCount",
  "thumbnailUrl",
  "provider",
  "sourceUrl",
] as const;

function rowFromObject(o: Record<string, string>): TourImportRow {
  return {
    name: (o.name ?? "").trim(),
    shortDescription: emptyToUndef(o.shortDescription) ?? null,
    durationDays: parseNumber(o.durationDays) ?? null,
    durationNights: parseNumber(o.durationNights) ?? null,
    departureFrom: emptyToUndef(o.departureFrom) ?? null,
    provinceCode: emptyToUndef(o.provinceCode) ?? null,
    priceFrom: parseNumber(o.priceFrom) ?? null,
    rating: parseNumber(o.rating) ?? null,
    reviewCount: parseNumber(o.reviewCount) ?? null,
    thumbnailUrl: emptyToUndef(o.thumbnailUrl) ?? null,
    provider: emptyToUndef(o.provider) ?? null,
    sourceUrl: (o.sourceUrl ?? "").trim(),
  };
}

function parseInput(text: string): TourImportRow[] {
  return parseRowsFromText(text).map(rowFromObject);
}

const ACTION_TONE = { create: "emerald", update: "blue", needsConfirm: "amber" } as const;
const ACTION_LABEL = { create: "Tạo mới", update: "Cập nhật", needsConfirm: "Cần xác nhận" } as const;

/** Nhap hang loat Tour tu Google Sheet/CSV/JSON — dry-run xem truoc truoc khi ghi that (tour-spec §5). */
export default function ImportToursPage() {
  const [text, setText] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [items, setItems] = useState<TourImportRow[] | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(await apiSend("POST", "/tours/fetch-sheet", { url: sheetUrl.trim() })),
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
      importToursResultSchema.parse(await apiSend("POST", "/tours/import", { items, dryRun: true })),
    onSuccess: () => setConfirmed(new Set()),
  });

  const apply = useMutation({
    mutationFn: async () =>
      importToursResultSchema.parse(
        await apiSend("POST", "/tours/import", {
          items,
          dryRun: false,
          confirmMergeIds: Object.fromEntries(
            (dryRun.data?.rows ?? [])
              .filter((r) => r.action === "needsConfirm" && confirmed.has(r.sourceUrl) && r.matchedId)
              .map((r) => [r.sourceUrl, r.matchedId as string]),
          ),
        }),
      ),
  });

  function handleParse() {
    setParseError(null);
    dryRun.reset();
    try {
      const parsed = parseInput(text);
      const bad = parsed.findIndex((r) => !r.name.trim() || !r.sourceUrl.trim());
      if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu tên hoặc link gốc (sourceUrl)`);
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
      <a href="/dichoithoi/tour" className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách tour
      </a>
      <div>
        <h2 className="text-xl font-semibold">Nhập danh sách tour</h2>
        <p className="text-sm text-zinc-500">
          Khớp theo <strong>sourceUrl</strong> (đã có → cập nhật). Trùng tên + tỉnh nhưng khác
          sourceUrl → cần xác nhận gộp, không tự ghi đè.
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
        <p className="mt-2 text-xs text-zinc-500">Cột hỗ trợ: {CSV_HEADERS.join(", ")}</p>
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
            Tạo mới {dryRun.data.created} · Cập nhật {dryRun.data.updated} · Cần xác nhận{" "}
            {dryRun.data.needsConfirm} · Lỗi {dryRun.data.errors}
          </p>
          <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {dryRun.data.rows.map((r, i) => (
              <RowPreview
                key={i}
                row={r}
                confirmed={confirmed.has(r.sourceUrl)}
                onToggleConfirm={() =>
                  setConfirmed((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.sourceUrl)) next.delete(r.sourceUrl);
                    else next.add(r.sourceUrl);
                    return next;
                  })
                }
              />
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
          ✅ Tạo mới {apply.data.created} · Cập nhật {apply.data.updated} · Còn cần xác nhận{" "}
          {apply.data.needsConfirm} · Lỗi {apply.data.errors}
          <a href="/dichoithoi/tour" className="mt-2 block text-blue-600 hover:underline dark:text-blue-400">
            → Về danh sách tour
          </a>
        </div>
      )}
    </div>
  );
}

function RowPreview({
  row,
  confirmed,
  onToggleConfirm,
}: {
  row: ImportTourRowResult;
  confirmed: boolean;
  onToggleConfirm: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
      <Badge tone={ACTION_TONE[row.action]}>{ACTION_LABEL[row.action]}</Badge>
      <span className="font-medium">{row.name}</span>
      <span className="text-xs text-zinc-500">{row.sourceUrl}</span>
      {row.reason && <span className="text-xs text-zinc-500">— {row.reason}</span>}
      {row.error && <span className="text-xs text-red-600 dark:text-red-400">— {row.error}</span>}
      {row.action === "needsConfirm" && (
        <Checkbox label="Xác nhận gộp" checked={confirmed} onChange={onToggleConfirm} />
      )}
    </div>
  );
}
