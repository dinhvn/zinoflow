"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KHUYENMAI_POST_TYPES,
  khuyenmaiPostTypeLabel,
  listCmsPostsResponseSchema,
  syncCmsPostsResultSchema,
  type CmsContentState,
  type CmsPost,
  type CmsPostSortBy,
  type KhuyenmaiSite,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button, buttonClasses } from "@/shared/ui/button";
import { DataTable, type DataTableColumn, type SortDirection } from "@/shared/ui/data-table";
import { ErrorBox } from "@/shared/ui/error-box";
import { Input } from "@/shared/ui/input";
import { Pagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";

const SITE_LABEL: Record<KhuyenmaiSite, string> = {
  laruki: "laruki.com (thời trang, làm đẹp)",
  dochoi3s: "dochoi3s.com (đồ chơi trẻ em)",
};
const SITE_DOMAIN: Record<KhuyenmaiSite, string> = {
  laruki: "https://laruki.com",
  dochoi3s: "https://dochoi3s.com",
};

const CONTENT_STATE_LABELS: Record<CmsContentState, string> = {
  "chua-co-bai": "Chưa có bài AI",
  "dang-soan": "Đang soạn / duyệt",
  "da-ghi-cms": "Đã ghi CMS (chưa publish)",
  "da-publish": "Đã publish",
};
const CONTENT_STATE_TONES: Record<CmsContentState, BadgeTone> = {
  "chua-co-bai": "gray",
  "dang-soan": "amber",
  "da-ghi-cms": "blue",
  "da-publish": "emerald",
};

/** Danh sach bai viet CMS — dung chung cho /laruki va /dochoi3s (khac site prop). */
export function CmsPostList({ site }: { site: KhuyenmaiSite }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [postType, setPostType] = useState("");
  const [contentState, setContentState] = useState("");
  const [sortBy, setSortBy] = useState<CmsPostSortBy>("dateUpdated");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["cms-posts", site, search, postType, contentState, sortBy, sortDir, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortBy,
        sortDir,
      });
      if (search) params.set("q", search);
      if (postType) params.set("postType", postType);
      if (contentState) params.set("contentState", contentState);
      return apiGet(`/cms/${site}/posts?${params}`, listCmsPostsResponseSchema);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () =>
      syncCmsPostsResultSchema.parse(await apiSend("POST", `/cms/${site}/sync`, {})),
    onSuccess: (r) => {
      setSyncMsg(
        `Đồng bộ xong (${(r.durationMs / 1000).toFixed(1)}s) — thêm ${r.added}, cập nhật ${r.updated}, không đổi ${r.unchanged}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["cms-posts", site] });
    },
    onError: (e) => setSyncMsg(e instanceof Error ? e.message : "Đồng bộ thất bại"),
  });

  const data = listQuery.data;
  const resetPage = () => setPage(1);
  function handleSort(key: string, dir: SortDirection) {
    setSortBy(key as CmsPostSortBy);
    setSortDir(dir);
    resetPage();
  }

  const columns: DataTableColumn<CmsPost>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      sortable: true,
      render: (p) => (
        <>
          <a
            href={`/${site}/${p.cmsId}`}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {p.title}
          </a>
          <div className="text-xs text-zinc-400">
            {p.postId === 0 ? "bài mới (chưa có WP post)" : `WP #${p.postId}`}
          </div>
        </>
      ),
    },
    { key: "postType", header: "Loại", sortable: true, render: (p) => khuyenmaiPostTypeLabel(p.postType) },
    {
      key: "contentState",
      header: "Trạng thái",
      sortable: true,
      render: (p) => (
        <Badge tone={CONTENT_STATE_TONES[p.contentState]}>{CONTENT_STATE_LABELS[p.contentState]}</Badge>
      ),
    },
    {
      key: "dateUpdated",
      header: "Cập nhật",
      sortable: true,
      render: (p) => (p.dateUpdated ? new Date(p.dateUpdated).toLocaleString("vi-VN") : "—"),
    },
    {
      key: "actions",
      header: "",
      cellClassName: "whitespace-nowrap",
      render: (p) => (
        <span className="flex items-center gap-3 text-xs">
          <a href={`/${site}/${p.cmsId}`} className={buttonClasses({ variant: "primary", size: "sm" })}>
            Chi tiết →
          </a>
          {p.link && (
            <a href={p.link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
              Mở web ↗
            </a>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bài viết — {SITE_LABEL[site]}</h2>
          <p className="text-sm text-zinc-500">
            Tạo / cập nhật nội dung bằng AI rồi ghi thẳng vào CMS. CMS giữ chèn tag + publish.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/${site}/new`} className={buttonClasses({ variant: "secondary" })}>
            + Bài mới
          </a>
          <Button variant="primary" loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
            {syncMutation.isPending ? "Đang đồng bộ..." : "Đồng bộ từ CMS"}
          </Button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {syncMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          placeholder="Tìm theo tiêu đề (gõ không dấu được)..."
          className="w-64"
        />
        <Select
          value={postType}
          onChange={(e) => {
            setPostType(e.target.value);
            resetPage();
          }}
        >
          <option value="">Mọi loại bài</option>
          {KHUYENMAI_POST_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          value={contentState}
          onChange={(e) => {
            setContentState(e.target.value);
            resetPage();
          }}
        >
          <option value="">Mọi trạng thái</option>
          {Object.entries(CONTENT_STATE_LABELS).map(([value, label]) => (
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
        rowKey={(p) => p.cmsId}
        loading={listQuery.isLoading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSort}
        emptyMessage={
          <span>
            Chưa có bài nào trong mirror. Bấm <strong>"Đồng bộ từ CMS"</strong> để nạp danh sách
            bài viết {SITE_DOMAIN[site]} về.
          </span>
        }
      />

      {data && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            resetPage();
          }}
        />
      )}
    </div>
  );
}
