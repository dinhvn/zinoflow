"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  importDestinationsResultSchema,
  type DestinationImportRow,
} from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const CSV_HEADERS = [
  "name",
  "slug",
  "kind",
  "provinceCode",
  "parentSlug",
  "shortDescription",
  "thumbnail",
  "lat",
  "lng",
  "addressNew",
  "addressOld",
  "contactPhone",
  "contactWebsite",
  "bookingUrl",
  "hotelGroupId",
  "isFeatured",
  "aiNotes",
  "referenceUrls",
] as const;

/** Parse CSV co ho tro o trong dau ngoac kep "" (xu ly dau phay/xuong dong ben trong). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  return rows;
}

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

function rowFromObject(o: Record<string, string | undefined>): DestinationImportRow {
  const num = (s: string | undefined) => {
    const v = emptyToUndef(s);
    return v === undefined ? undefined : Number(v);
  };
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
    lat: num(o.lat),
    lng: num(o.lng),
    addressNew: emptyToUndef(o.addressNew),
    addressOld: emptyToUndef(o.addressOld),
    contactPhone: emptyToUndef(o.contactPhone),
    contactWebsite: emptyToUndef(o.contactWebsite),
    bookingUrl: emptyToUndef(o.bookingUrl),
    hotelGroupId: emptyToUndef(o.hotelGroupId),
    isFeatured: bool(o.isFeatured),
    aiNotes: emptyToUndef(o.aiNotes),
    referenceUrls: parseRefUrls(o.referenceUrls),
  };
}

/** Chuyen text (CSV hoac JSON) -> danh sach dong import. Nem Error neu sai dinh dang. */
function parseInput(text: string): DestinationImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Chưa có dữ liệu");
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed);
    const arr = Array.isArray(json) ? json : [json];
    return arr.map((o) => rowFromObject(o as Record<string, string | undefined>));
  }
  // CSV: dong dau la header
  const rows = parseCsv(trimmed);
  if (rows.length < 2) throw new Error("CSV cần dòng tiêu đề + ít nhất 1 dòng dữ liệu");
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return rowFromObject(o);
  });
}

/** Import hang loat tu CSV/JSON (spec §7.2) — UPSERT theo slug, khong wipe. */
export default function ImportDestinationsPage() {
  const [text, setText] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DestinationImportRow[] | null>(null);

  // Tai Google Sheet (cong khai) -> CSV roi parse + xem truoc nhu file
  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(
        await apiSend("POST", "/destinations/fetch-sheet", { url: sheetUrl.trim() }),
      ),
    onSuccess: (r) => {
      setText(r.csv);
      setPreview(null);
      importMutation.reset();
      try {
        const items = parseInput(r.csv);
        const bad = items.findIndex((x) => !x.name.trim());
        if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu tên điểm đến`);
        setParseError(null);
        setPreview(items);
      } catch (e) {
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
  });

  function handleParse() {
    setParseError(null);
    importMutation.reset();
    try {
      const items = parseInput(text);
      const bad = items.findIndex((r) => !r.name.trim());
      if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu tên điểm đến`);
      if (items.length === 0) throw new Error("Không có dòng nào");
      setPreview(items);
    } catch (e) {
      setPreview(null);
      setParseError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleFile(file: File) {
    setText(await file.text());
    setPreview(null);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <a href="/dichoithoi" className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>
      <div>
        <h2 className="text-xl font-semibold">Nhập danh sách điểm đến</h2>
        <p className="text-sm text-zinc-500">
          Nhập từ <strong>Google Sheet</strong> (hoặc dán JSON/CSV). Khớp theo{" "}
          <strong>slug</strong> (thiếu thì tự sinh từ tên): slug đã có → cập nhật, chưa có → tạo
          mới. Không bao giờ xoá dữ liệu cũ.
        </p>
      </div>

      {/* Nhap tu Google Sheet */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="mb-1 block text-sm font-medium">Link Google Sheet</label>
        <p className="mb-2 text-xs text-zinc-500">
          Sheet phải đặt chia sẻ <strong>&quot;Bất kỳ ai có đường liên kết: Người xem&quot;</strong>.
          Dòng đầu là tiêu đề cột (xem tên cột bên dưới). Tải về sẽ tự xem trước.
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
            {fetchSheet.isPending ? "Đang tải..." : "Tải từ Sheet"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Cột hỗ trợ: {CSV_HEADERS.join(", ")}
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
            setPreview(null);
          }}
          rows={10}
          placeholder={`CSV: ${CSV_HEADERS.join(",")}\n\nhoặc JSON: [{"name":"Núi Hàm Rồng","provinceCode":"15","aiNotes":"Vé 70k","referenceUrls":[{"label":"Giá vé","url":"https://..."}]}]`}
          className="w-full rounded border border-zinc-300 bg-transparent p-2 font-mono text-xs dark:border-zinc-700"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" disabled={!text.trim()} onClick={handleParse}>
            Kiểm tra dữ liệu
          </Button>
          {preview && (
            <Button
              variant="primary"
              size="sm"
              loading={importMutation.isPending}
              onClick={() => importMutation.mutate(preview)}
            >
              {importMutation.isPending ? "Đang nhập..." : `Nhập ${preview.length} điểm`}
            </Button>
          )}
        </div>

        {parseError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">⚠️ {parseError}</p>
        )}
        {preview && !importMutation.data && (
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Đọc được <strong>{preview.length}</strong> dòng. Xem trước 5 dòng đầu:
            <ul className="mt-1 list-inside list-disc text-xs">
              {preview.slice(0, 5).map((r, i) => (
                <li key={i}>
                  {r.name} {r.slug ? `(${r.slug})` : "(slug tự sinh)"} ·{" "}
                  {r.provinceCode ?? "không tỉnh"} · {r.kind}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {importMutation.isError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {importMutation.error instanceof ApiError
            ? importMutation.error.message
            : "Nhập thất bại"}
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
          <a href="/dichoithoi" className="mt-2 inline-block text-blue-600 hover:underline dark:text-blue-400">
            → Về danh sách điểm đến
          </a>
        </div>
      )}
    </div>
  );
}
