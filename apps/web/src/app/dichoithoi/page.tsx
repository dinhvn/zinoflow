"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  destinationTaxonomySchema,
  listDestinationsResponseSchema,
  recomputeRelatedReportSchema,
  relinkAllReportSchema,
  syncDestinationsResultSchema,
  type DestinationContentState,
  type DestinationKind,
  type RecomputeRelatedReport,
  type RelinkAllReport,
  type SyncDestinationsResult,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";

const KIND_LABELS: Record<DestinationKind, string> = {
  province: "Tỉnh/Thành",
  cluster: "Cụm",
  poi: "Điểm đến",
};

const CONTENT_STATE_LABELS: Record<DestinationContentState, string> = {
  "chua-co-bai": "Chưa có bài",
  "bai-tay": "Bài viết tay",
  "dang-soan": "Đang soạn / duyệt",
  "da-publish": "Đã publish (AI)",
};

const CONTENT_STATE_STYLES: Record<DestinationContentState, string> = {
  "chua-co-bai": "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "bai-tay": "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "dang-soan": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "da-publish": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const SYNC_FLAG_LABELS: Record<string, string> = {
  "edited-outside": "Bị sửa ngoài luồng",
  conflict: "Xung đột",
  orphan: "Mất bên website",
};

const SITE_BASE_URL = "https://dichoithoi.com";

/** Hub khu Dichoithoi — danh sách điểm đến từ mirror (spec §7.2). */
export default function DichoithoiPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [kind, setKind] = useState("");
  const [contentState, setContentState] = useState("");
  const [page, setPage] = useState(1);
  const [syncResult, setSyncResult] = useState<SyncDestinationsResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const taxonomyQuery = useQuery({
    queryKey: ["dichoithoi-taxonomy"],
    queryFn: () => apiGet("/destinations/taxonomy", destinationTaxonomySchema),
    staleTime: 5 * 60 * 1000,
  });

  const listQuery = useQuery({
    queryKey: ["dichoithoi-destinations", search, provinceCode, kind, contentState, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("q", search);
      if (provinceCode) params.set("provinceCode", provinceCode);
      if (kind) params.set("kind", kind);
      if (contentState) params.set("contentState", contentState);
      return apiGet(`/destinations?${params}`, listDestinationsResponseSchema);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () =>
      syncDestinationsResultSchema.parse(await apiSend("POST", "/destinations/sync", {})),
    onSuccess: (result) => {
      setSyncResult(result);
      setSyncError(null);
      void queryClient.invalidateQueries({ queryKey: ["dichoithoi-destinations"] });
    },
    onError: (err) => {
      setSyncResult(null);
      setSyncError(err instanceof Error ? err.message : "Đồng bộ thất bại");
    },
  });

  // Cong cu van hanh (spec §12.2, §12.3): re-link xem truoc -> xac nhan ghi; recompute related
  const [relinkReport, setRelinkReport] = useState<RelinkAllReport | null>(null);
  const [relatedReport, setRelatedReport] = useState<RecomputeRelatedReport | null>(null);
  const relinkMutation = useMutation({
    mutationFn: async (dryRun: boolean) =>
      relinkAllReportSchema.parse(await apiSend("POST", "/destinations/relink", { dryRun })),
    onSuccess: (report) => {
      setRelinkReport(report);
      setSyncError(null);
      if (!report.dryRun) {
        void queryClient.invalidateQueries({ queryKey: ["dichoithoi-destinations"] });
      }
    },
    onError: (err) => setSyncError(err instanceof Error ? err.message : "Re-link thất bại"),
  });
  const recomputeMutation = useMutation({
    mutationFn: async () =>
      recomputeRelatedReportSchema.parse(
        await apiSend("POST", "/destinations/recompute-related", {}),
      ),
    onSuccess: (report) => {
      setRelatedReport(report);
      setSyncError(null);
    },
    onError: (err) =>
      setSyncError(err instanceof Error ? err.message : "Tính lại khối liên quan thất bại"),
  });

  const data = listQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Điểm đến — dichoithoi.com</h2>
          <p className="text-sm text-zinc-500">
            Quản lý bài viết điểm đến. Dữ liệu đồng bộ từ database website (schema v2).
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/dichoithoi/new"
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            + Thêm điểm đến
          </a>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {syncMutation.isPending ? "Đang đồng bộ..." : "Đồng bộ từ website"}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {syncError}
        </div>
      )}
      {syncResult && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Đồng bộ xong sau {(syncResult.durationMs / 1000).toFixed(1)}s — thêm{" "}
          {syncResult.added}, cập nhật {syncResult.updated}, không đổi {syncResult.unchanged}.
          {syncResult.editedOutside.length > 0 && (
            <div className="mt-1 text-amber-700 dark:text-amber-300">
              ⚠️ {syncResult.editedOutside.length} bài bị sửa trực tiếp trên DB (publish đè sẽ
              mất phần sửa): {syncResult.editedOutside.join(", ")}
            </div>
          )}
          {syncResult.orphans.length > 0 && (
            <div className="mt-1 text-amber-700 dark:text-amber-300">
              ⚠️ {syncResult.orphans.length} điểm có ở mirror nhưng mất bên website:{" "}
              {syncResult.orphans.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Cong cu van hanh (spec §7.6): chay sau khi publish diem den moi */}
      <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Công cụ:</span>
          <button
            onClick={() => relinkMutation.mutate(true)}
            disabled={relinkMutation.isPending}
            className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {relinkMutation.isPending ? "Đang quét..." : "Re-link toàn bộ (xem trước)"}
          </button>
          {relinkReport?.dryRun && relinkReport.changed > 0 && (
            <button
              onClick={() => relinkMutation.mutate(false)}
              disabled={relinkMutation.isPending}
              className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Áp dụng {relinkReport.linksAdded} link vào website
            </button>
          )}
          <button
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
            className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {recomputeMutation.isPending ? "Đang tính..." : "Tính lại khối liên quan"}
          </button>
        </div>

        {relinkReport && (
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              {relinkReport.dryRun ? "🔍 Xem trước" : "✅ Đã ghi"}: quét {relinkReport.scanned} bài,{" "}
              {relinkReport.changed} bài thay đổi, thêm {relinkReport.linksAdded} link nội bộ,
              chuẩn hóa {relinkReport.linksNormalized} link cũ (
              {(relinkReport.durationMs / 1000).toFixed(1)}s).
            </p>
            {relinkReport.details.length > 0 && (
              <ul className="mt-1 max-h-48 list-inside list-disc overflow-y-auto text-xs">
                {relinkReport.details.map((d) => (
                  <li key={d.slug}>
                    <span className="font-mono">{d.slug}</span>
                    {d.addedLinks.length > 0 &&
                      ` — thêm link: ${d.addedLinks.map((l) => l.targetName).join(", ")}`}
                    {d.normalizedLinks.length > 0 &&
                      ` — chuẩn hóa: ${d.normalizedLinks.join("; ")}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {relatedReport && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            ✅ Khối liên quan: quét {relatedReport.scanned} bài, cập nhật {relatedReport.updated}{" "}
            bài ({(relatedReport.durationMs / 1000).toFixed(1)}s).
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo tên (gõ không dấu được)..."
          className="w-64 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={provinceCode}
          onChange={(e) => {
            setProvinceCode(e.target.value);
            setPage(1);
          }}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Tất cả tỉnh/thành</option>
          {taxonomyQuery.data?.provinces.map((p) => (
            <option key={p.provinceCode} value={p.provinceCode}>
              {p.shortName}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Mọi cấp</option>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={contentState}
          onChange={(e) => {
            setContentState(e.target.value);
            setPage(1);
          }}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Mọi trạng thái bài</option>
          {Object.entries(CONTENT_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {listQuery.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {listQuery.isError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {listQuery.error instanceof Error ? listQuery.error.message : "Lỗi tải danh sách"}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded border border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          Chưa có điểm đến nào trong mirror.
          <br />
          Bấm <strong>"Đồng bộ từ website"</strong> để nạp dữ liệu lần đầu (cần chạy script
          migration schema v2 trên SQL Server trước).
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Tên</th>
                  <th className="px-3 py-2 font-medium">Tỉnh/Thành</th>
                  <th className="px-3 py-2 font-medium">Cấp</th>
                  <th className="px-3 py-2 font-medium">Trạng thái bài</th>
                  <th className="px-3 py-2 font-medium">Cảnh báo</th>
                  <th className="px-3 py-2 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((d) => (
                  <tr
                    key={d.slug}
                    className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-2">
                      <a
                        href={`/dichoithoi/${d.slug}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {d.name}
                      </a>
                      <div className="text-xs text-zinc-400">{d.slug}</div>
                    </td>
                    <td className="px-3 py-2">{d.provinceName ?? "—"}</td>
                    <td className="px-3 py-2">{KIND_LABELS[d.kind]}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${CONTENT_STATE_STYLES[d.contentState]}`}
                      >
                        {CONTENT_STATE_LABELS[d.contentState]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {d.syncFlags.length === 0
                        ? ""
                        : d.syncFlags.map((f) => (
                            <span
                              key={f}
                              className="mr-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            >
                              {SYNC_FLAG_LABELS[f] ?? f}
                            </span>
                          ))}
                    </td>
                    <td className="space-x-3 whitespace-nowrap px-3 py-2 text-xs">
                      <a
                        href={`/dichoithoi/${d.slug}`}
                        className="rounded bg-zinc-900 px-2 py-1 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Chi tiết →
                      </a>
                      <a
                        href={`${SITE_BASE_URL}/diem-den/${d.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Mở web ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              {data.total} điểm đến — trang {data.page}/{totalPages}
            </span>
            <div className="space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
              >
                ← Trước
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
              >
                Sau →
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
