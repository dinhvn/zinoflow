"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  destinationTaxonomySchema,
  dichoithoiDashboardAlertsResponseSchema,
  listDestinationsResponseSchema,
  migrateDestinationImagesReportSchema,
  recomputeRelatedReportSchema,
  refreshAllDynamicBlocksReportSchema,
  relinkAllReportSchema,
  syncDestinationsResultSchema,
  type MigrateDestinationImagesReport,
  type DestinationContentState,
  type DestinationKind,
  type DestinationMirror,
  type DestinationProductionState,
  type DestinationSortBy,
  type RecomputeRelatedReport,
  type RefreshAllDynamicBlocksReport,
  type RelinkAllReport,
  type SyncDestinationsResult,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Card, ActionRow } from "@/shared/ui/card";
import { DataTable, type DataTableColumn, type SortDirection } from "@/shared/ui/data-table";
import { ErrorBox } from "@/shared/ui/error-box";
import { Input } from "@/shared/ui/input";
import { Pagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { PageHeader } from "@/shared/ui/page-header";
import { ImportDestinationsModal } from "@/features/dichoithoi/import-destinations-modal";

/** Khoi "Viec can lam" tren hub (destination-spec §7.2, Phase 23) — chi hien
 * khi co it nhat 1 canh bao (nguyen tac "khong hien muc chi de biet"). */
function DashboardAlertsCard() {
  const query = useQuery({
    queryKey: ["dichoithoi-dashboard-alerts"],
    queryFn: () =>
      apiGet("/destinations/dashboard-alerts", dichoithoiDashboardAlertsResponseSchema),
    staleTime: 5 * 60 * 1000,
  });
  const data = query.data;
  if (!data || data.alerts.length === 0) return null;

  return (
    <Card title="Việc cần làm">
      <div className="mb-3 text-sm text-zinc-500">
        {data.coverageHealthPercent}% điểm đến đạt độ phủ nội dung mục tiêu
      </div>
      <div className="space-y-2">
        {data.alerts.map((a) => (
          <ActionRow key={a.key} label={a.label} count={a.count} href={a.href} tone="amber" />
        ))}
      </div>
    </Card>
  );
}

const KIND_LABELS: Record<DestinationKind, string> = {
  province: "Tỉnh/Thành",
  cluster: "Cụm",
  poi: "Điểm đến",
};

const CONTENT_STATE_LABELS: Record<DestinationContentState, string> = {
  "chua-co-bai": "Chưa có bài",
  "bai-tay": "Bài viết tay",
  "dang-soan": "Đang soạn / duyệt",
  "da-duyet": "Đã duyệt · chờ publish",
  "da-publish": "Đã publish (AI)",
};

const CONTENT_STATE_TONES: Record<DestinationContentState, BadgeTone> = {
  "chua-co-bai": "gray",
  "bai-tay": "blue",
  "dang-soan": "amber",
  "da-duyet": "indigo",
  "da-publish": "emerald",
};

// Tinh trang ben production (dichoithoi.com) — tach rieng khoi trang thai bai
const PRODUCTION_LABELS: Record<DestinationProductionState, string> = {
  online: "Online",
  hidden: "Ẩn",
  draft: "Nháp",
  "not-live": "Chưa lên",
};

const PRODUCTION_TONES: Record<DestinationProductionState, BadgeTone> = {
  online: "emerald",
  hidden: "amber",
  draft: "blue",
  "not-live": "gray",
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
  const [production, setProduction] = useState("");
  const [sortBy, setSortBy] = useState<DestinationSortBy>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [syncResult, setSyncResult] = useState<SyncDestinationsResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const taxonomyQuery = useQuery({
    queryKey: ["dichoithoi-taxonomy"],
    queryFn: () => apiGet("/destinations/taxonomy", destinationTaxonomySchema),
    staleTime: 5 * 60 * 1000,
  });

  const listQuery = useQuery({
    queryKey: [
      "dichoithoi-destinations",
      search,
      provinceCode,
      kind,
      contentState,
      production,
      sortBy,
      sortDir,
      page,
      pageSize,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortBy,
        sortDir,
      });
      if (search) params.set("q", search);
      if (provinceCode) params.set("provinceCode", provinceCode);
      if (kind) params.set("kind", kind);
      if (contentState) params.set("contentState", contentState);
      if (production) params.set("production", production);
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

  // Cong cu van hanh (spec §12.2, §12.3): re-link xem truoc (dong bo) -> ap dung
  // that qua pg-boss (fire-and-forget, xem RelinkAllWorker) -> recompute related.
  const [relinkReport, setRelinkReport] = useState<RelinkAllReport | null>(null);
  const [relinkApplyQueued, setRelinkApplyQueued] = useState(false);
  const [relatedReport, setRelatedReport] = useState<RecomputeRelatedReport | null>(null);
  const relinkMutation = useMutation({
    mutationFn: async () =>
      relinkAllReportSchema.parse(await apiSend("POST", "/destinations/relink", { dryRun: true })),
    onSuccess: (report) => {
      setRelinkReport(report);
      setRelinkApplyQueued(false);
      setSyncError(null);
    },
    onError: (err) => setSyncError(err instanceof Error ? err.message : "Re-link thất bại"),
  });
  const relinkApplyMutation = useMutation({
    mutationFn: async () => apiSend("POST", "/destinations/relink/apply", {}),
    onSuccess: () => {
      setRelinkApplyQueued(true);
      setSyncError(null);
      void queryClient.invalidateQueries({ queryKey: ["dichoithoi-destinations"] });
    },
    onError: (err) => setSyncError(err instanceof Error ? err.message : "Đưa vào hàng đợi thất bại"),
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

  const [refreshBlocksReport, setRefreshBlocksReport] = useState<RefreshAllDynamicBlocksReport | null>(
    null,
  );
  const refreshAllBlocksMutation = useMutation({
    mutationFn: async () =>
      refreshAllDynamicBlocksReportSchema.parse(
        await apiSend("POST", "/articles/refresh-all-blocks", {}),
      ),
    onSuccess: (report) => {
      setRefreshBlocksReport(report);
      setSyncError(null);
    },
    onError: (err) =>
      setSyncError(err instanceof Error ? err.message : "Làm mới khối động thất bại"),
  });

  // Migrate anh layout cu -> {slug}/3 co WebP (chay theo batch, idempotent)
  const [migrateReport, setMigrateReport] = useState<MigrateDestinationImagesReport | null>(null);
  const migrateMutation = useMutation({
    mutationFn: async (dryRun: boolean) =>
      migrateDestinationImagesReportSchema.parse(
        await apiSend("POST", "/destinations/migrate-images", { dryRun, limit: 20 }),
      ),
    onSuccess: (report) => {
      setMigrateReport(report);
      setSyncError(null);
      if (!report.dryRun && report.migrated.length > 0) {
        void queryClient.invalidateQueries({ queryKey: ["dichoithoi-destinations"] });
      }
    },
    onError: (err) => setSyncError(err instanceof Error ? err.message : "Migrate ảnh thất bại"),
  });

  // Chay lien tiep nhieu batch 20 anh toi khi het (nut "Migrate tat ca") — tranh 1 request
  // qua dai (moi anh: doc file + resize + 3 lan FTP upload), moi batch van cap nhat report
  // de thay tien do dan.
  const [migrateAllRunning, setMigrateAllRunning] = useState(false);
  async function runMigrateAll() {
    setMigrateAllRunning(true);
    try {
      let remaining = 1;
      while (remaining > 0) {
        const report = await migrateMutation.mutateAsync(false);
        remaining = report.remaining;
        // Khong migrate them duoc diem nao (vd loi FTP lien tuc) -> dung, tranh vong lap vo han
        if (report.migrated.length === 0) break;
      }
    } catch {
      // Loi da duoc migrateMutation.onError xu ly (hien syncError)
    } finally {
      setMigrateAllRunning(false);
    }
  }

  const data = listQuery.data;

  // Doi filter -> ve trang 1 (tranh ket o trang trong)
  function resetToFirstPage() {
    setPage(1);
  }
  function handleSort(key: string, dir: SortDirection) {
    setSortBy(key as DestinationSortBy);
    setSortDir(dir);
    resetToFirstPage();
  }

  const columns: DataTableColumn<DestinationMirror>[] = [
    {
      key: "name",
      header: "Tên",
      sortable: true,
      render: (d) => (
        <div className="flex items-center gap-3">
          {d.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.imageUrl}
              alt=""
              className="h-10 w-14 shrink-0 rounded object-cover"
              loading="lazy"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
          ) : (
            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400 dark:bg-zinc-800">
              chưa có
            </div>
          )}
          <div className="min-w-0">
            <a
              href={`/dichoithoi/${d.slug}`}
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {d.name}
            </a>
            <div className="text-xs text-zinc-400">{d.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: "province",
      header: "Tỉnh/Thành",
      sortable: true,
      render: (d) => d.provinceName ?? "—",
    },
    {
      key: "kind",
      header: "Cấp",
      sortable: true,
      render: (d) => KIND_LABELS[d.kind],
    },
    {
      key: "contentState",
      header: "Trạng thái bài",
      sortable: true,
      render: (d) => (
        <Badge tone={CONTENT_STATE_TONES[d.contentState]}>
          {CONTENT_STATE_LABELS[d.contentState]}
        </Badge>
      ),
    },
    {
      key: "production",
      header: "Trên web",
      render: (d) => (
        <Badge tone={PRODUCTION_TONES[d.productionState]}>
          {PRODUCTION_LABELS[d.productionState]}
        </Badge>
      ),
    },
    {
      key: "syncFlags",
      header: "Cảnh báo",
      render: (d) =>
        d.syncFlags.map((f) => (
          <Badge key={f} tone="amber" className="mr-1">
            {SYNC_FLAG_LABELS[f] ?? f}
          </Badge>
        )),
    },
    {
      key: "actions",
      header: "Hành động",
      cellClassName: "whitespace-nowrap",
      render: (d) => (
        <span className="flex items-center gap-3 text-xs">
          <a href={`/dichoithoi/${d.slug}`} className={buttonClasses({ variant: "primary", size: "sm" })}>
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
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Điểm đến — dichoithoi.com"
        description="Quản lý bài viết điểm đến. Dữ liệu đồng bộ từ database website (schema v2)."
        actions={
          <>
            <a href="/dichoithoi/new" className={buttonClasses({ variant: "secondary" })}>
              + Thêm điểm đến
            </a>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className={buttonClasses({ variant: "secondary" })}
            >
              Nhập từ Sheet
            </button>
            <a href="/dichoithoi/articles/new" className={buttonClasses({ variant: "secondary" })}>
              + Bài cẩm nang
            </a>
            <Button
              variant="primary"
              loading={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? "Đang đồng bộ..." : "Đồng bộ từ website"}
            </Button>
          </>
        }
      />

      <DashboardAlertsCard />

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
          <Button size="sm" loading={relinkMutation.isPending} onClick={() => relinkMutation.mutate()}>
            {relinkMutation.isPending ? "Đang quét..." : "Re-link toàn bộ (xem trước)"}
          </Button>
          {relinkReport && relinkReport.changed > 0 && (
            <Button
              size="sm"
              className="bg-blue-600 text-white hover:bg-blue-700"
              loading={relinkApplyMutation.isPending}
              disabled={relinkApplyQueued}
              onClick={() => relinkApplyMutation.mutate()}
            >
              {relinkApplyQueued
                ? "Đã đưa vào hàng đợi ✓"
                : `Áp dụng ${relinkReport.linksAdded} link vào website`}
            </Button>
          )}
          <Button size="sm" loading={recomputeMutation.isPending} onClick={() => recomputeMutation.mutate()}>
            {recomputeMutation.isPending ? "Đang tính..." : "Tính lại khối liên quan"}
          </Button>
          <Button
            size="sm"
            loading={refreshAllBlocksMutation.isPending}
            onClick={() => refreshAllBlocksMutation.mutate()}
          >
            {refreshAllBlocksMutation.isPending ? "Đang làm mới..." : "Làm mới toàn bộ khối động"}
          </Button>
          <Button
            size="sm"
            loading={migrateMutation.isPending && migrateMutation.variables === true}
            onClick={() => migrateMutation.mutate(true)}
          >
            Migrate ảnh cũ (xem trước)
          </Button>
          {migrateReport && migrateReport.remaining > 0 && (
            <>
              <Button
                size="sm"
                className="bg-blue-600 text-white hover:bg-blue-700"
                loading={!migrateAllRunning && migrateMutation.isPending && migrateMutation.variables === false}
                disabled={migrateAllRunning}
                onClick={() => migrateMutation.mutate(false)}
              >
                Migrate 20 ảnh tiếp theo ({migrateReport.remaining} còn lại)
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={migrateAllRunning}
                onClick={runMigrateAll}
              >
                Migrate tất cả ({migrateReport.remaining} ảnh)
              </Button>
            </>
          )}
        </div>

        {relinkReport && (
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              🔍 Xem trước: quét {relinkReport.scanned} bài,{" "}
              {relinkReport.changed} bài thay đổi, thêm {relinkReport.linksAdded} link nội bộ,
              chuẩn hóa {relinkReport.linksNormalized} link cũ (
              {(relinkReport.durationMs / 1000).toFixed(1)}s).
              {relinkApplyQueued && " Đã đưa vào hàng đợi — website sẽ cập nhật trong giây lát."}
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
        {refreshBlocksReport && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            ✅ Khối động: kiểm tra {refreshBlocksReport.totalChecked} bài, làm mới{" "}
            {refreshBlocksReport.totalRefreshed} bài
            {refreshBlocksReport.failures.length > 0 &&
              ` (${refreshBlocksReport.failures.length} lỗi: ${refreshBlocksReport.failures
                .map((f) => f.slug)
                .join(", ")})`}
            .
          </p>
        )}
        {migrateReport && (
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              {migrateReport.dryRun ? "🔍 Xem trước migrate ảnh" : "✅ Migrate ảnh"}: tổng{" "}
              {migrateReport.scanned} điểm — {migrateReport.alreadyNew} đã theo chuẩn mới,{" "}
              {migrateReport.candidates} cần migrate
              {!migrateReport.dryRun && (
                <>
                  ; lần này chuyển được {migrateReport.migrated.length}, còn lại{" "}
                  {migrateReport.remaining}
                </>
              )}{" "}
              ({(migrateReport.durationMs / 1000).toFixed(1)}s).
            </p>
            {migrateReport.missingSource.length > 0 && (
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                ⚠️ {migrateReport.missingSource.length} điểm không tải được ảnh gốc cũ:{" "}
                {migrateReport.missingSource.join(", ")}
              </p>
            )}
            {migrateReport.failed.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-red-600 dark:text-red-400">
                {migrateReport.failed.map((f) => (
                  <li key={f.slug}>
                    <span className="font-mono">{f.slug}</span> — {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetToFirstPage();
          }}
          placeholder="Tìm theo tên (gõ không dấu được)..."
          className="w-64"
        />
        <Select
          value={provinceCode}
          onChange={(e) => {
            setProvinceCode(e.target.value);
            resetToFirstPage();
          }}
        >
          <option value="">Tất cả tỉnh/thành</option>
          {taxonomyQuery.data?.provinces.map((p) => (
            <option key={p.provinceCode} value={p.provinceCode}>
              {p.shortName}
            </option>
          ))}
        </Select>
        <Select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            resetToFirstPage();
          }}
        >
          <option value="">Mọi cấp</option>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={contentState}
          onChange={(e) => {
            setContentState(e.target.value);
            resetToFirstPage();
          }}
        >
          <option value="">Mọi trạng thái bài</option>
          {Object.entries(CONTENT_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={production}
          onChange={(e) => {
            setProduction(e.target.value);
            resetToFirstPage();
          }}
        >
          <option value="">Mọi tình trạng web</option>
          {Object.entries(PRODUCTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {listQuery.isError && <ErrorBox error={listQuery.error} fallback="Lỗi tải danh sách" />}

      <DataTable
        columns={columns}
        items={data?.items ?? []}
        rowKey={(d) => d.slug}
        loading={listQuery.isLoading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSort}
        emptyMessage={
          <span>
            Chưa có điểm đến nào khớp bộ lọc. Bấm <strong>"Đồng bộ từ website"</strong> để nạp dữ
            liệu lần đầu (cần chạy migration schema v2 trên SQL Server trước).
          </span>
        }
      />

      {data && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            resetToFirstPage();
          }}
        />
      )}

      <ImportDestinationsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["dichoithoi-destinations"] })}
      />
    </div>
  );
}
