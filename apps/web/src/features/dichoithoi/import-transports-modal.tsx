"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSheetResponseSchema,
  importTransportsResultSchema,
  type ImportTransportRowResult,
  type TransportImportRow,
} from "@zinoflow/contracts";
import { apiSend } from "@/shared/api-client";
import { Badge, Button, Checkbox, ErrorBox, Input, Modal } from "@/shared/ui";
import { emptyToUndef, parseNumber, parseRowsFromText } from "./sheet-import-csv";

const CSV_HEADERS = [
  "operatorName",
  "phone",
  "vehicleType",
  "priceFrom",
  "thumbnailUrl",
  "provider",
  "sourceUrl",
  "originSlug",
  "destinationSlug",
  "waypointSlugs",
] as const;

function rowFromObject(o: Record<string, string>): TransportImportRow {
  return {
    operatorName: (o.operatorName ?? "").trim(),
    phone: emptyToUndef(o.phone) ?? null,
    vehicleType: emptyToUndef(o.vehicleType) ?? null,
    priceFrom: parseNumber(o.priceFrom) ?? null,
    thumbnailUrl: emptyToUndef(o.thumbnailUrl) ?? null,
    provider: emptyToUndef(o.provider) ?? null,
    sourceUrl: emptyToUndef(o.sourceUrl) ?? null,
    originSlug: (o.originSlug ?? "").trim(),
    destinationSlug: (o.destinationSlug ?? "").trim(),
    waypointSlugs: (o.waypointSlugs ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

const ACTION_TONE = { create: "emerald", update: "blue", needsConfirm: "amber" } as const;
const ACTION_LABEL = { create: "Tạo mới", update: "Cập nhật", needsConfirm: "Cần xác nhận" } as const;

/**
 * Modal "Nhập từ Sheet" cho Vận chuyển (Xe khách, mode=bus) — cùng luồng
 * xem trước (dry-run) → xác nhận gộp trùng → ghi thật như Hotel/Tour/Vé
 * (transport-plan §3, product-spec §5.1). Khác Hotel: xác nhận gộp theo
 * INDEX dòng (không phải sourceUrl, vì nhiều nhà xe không có sourceUrl).
 */
export function ImportTransportsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [items, setItems] = useState<TransportImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());

  const fetchSheet = useMutation({
    mutationFn: async () =>
      fetchSheetResponseSchema.parse(
        await apiSend("POST", "/transports/fetch-sheet", { url: sheetUrl.trim() }),
      ),
    onSuccess: (r) => {
      dryRun.reset();
      try {
        const rows = parseRowsFromText(r.csv).map(rowFromObject);
        const bad = rows.findIndex(
          (x) => !x.operatorName.trim() || !x.originSlug.trim() || !x.destinationSlug.trim(),
        );
        if (bad >= 0) throw new Error(`Dòng ${bad + 1}: thiếu tên nhà xe hoặc điểm đầu/cuối`);
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
      importTransportsResultSchema.parse(
        await apiSend("POST", "/transports/import", { items, dryRun: true }),
      ),
    onSuccess: () => setConfirmed(new Set()),
  });

  const apply = useMutation({
    mutationFn: async () =>
      importTransportsResultSchema.parse(
        await apiSend("POST", "/transports/import", {
          items,
          dryRun: false,
          confirmMergeIndexes: (dryRun.data?.rows ?? [])
            .filter((r) => r.action === "needsConfirm" && confirmed.has(r.index))
            .map((r) => r.index),
        }),
      ),
    onSuccess: onImported,
  });

  function handleClose() {
    setItems(null);
    setParseError(null);
    setConfirmed(new Set());
    fetchSheet.reset();
    dryRun.reset();
    apply.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nhập tuyến xe khách từ Google Sheet">
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          Khớp theo <strong>sourceUrl</strong> (nếu có) hoặc <strong>tên nhà xe + tuyến</strong> khi
          trùng — cần xác nhận gộp, không tự ghi đè.
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
          Cột hỗ trợ: {CSV_HEADERS.join(", ")} — <code>originSlug</code>/<code>destinationSlug</code>{" "}
          là slug cụm/tỉnh có sẵn trong hệ thống; <code>waypointSlugs</code> nhiều điểm cách nhau bằng
          dấu <code>;</code>.
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
              Tạo mới {dryRun.data.created} · Cập nhật {dryRun.data.updated} · Cần xác nhận{" "}
              {dryRun.data.needsConfirm} · Lỗi {dryRun.data.errors}
            </p>
            <div className="max-h-64 divide-y divide-zinc-200 overflow-y-auto rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {dryRun.data.rows.map((r) => (
                <RowPreview
                  key={r.index}
                  row={r}
                  confirmed={confirmed.has(r.index)}
                  onToggleConfirm={() =>
                    setConfirmed((prev) => {
                      const next = new Set(prev);
                      if (next.has(r.index)) next.delete(r.index);
                      else next.add(r.index);
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
          </div>
        )}
      </div>
    </Modal>
  );
}

function RowPreview({
  row,
  confirmed,
  onToggleConfirm,
}: {
  row: ImportTransportRowResult;
  confirmed: boolean;
  onToggleConfirm: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 text-sm">
      <Badge tone={ACTION_TONE[row.action]}>{ACTION_LABEL[row.action]}</Badge>
      <span className="font-medium">{row.operatorName}</span>
      <span className="text-xs text-zinc-500">
        {row.originSlug} → {row.destinationSlug}
      </span>
      {row.reason && <span className="text-xs text-zinc-500">— {row.reason}</span>}
      {row.error && <span className="text-xs text-red-600 dark:text-red-400">— {row.error}</span>}
      {row.action === "needsConfirm" && (
        <Checkbox label="Xác nhận gộp" checked={confirmed} onChange={onToggleConfirm} />
      )}
    </div>
  );
}
