"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  contentJobSchema,
  type ArticleType,
  type ContentJobStatus,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

const jobsListSchema = z.array(contentJobSchema);

/** Job dang chay thi poll nhanh; xong het thi poll cham. */
const ACTIVE_STATUSES: ContentJobStatus[] = ["Created", "GeneratingOutline"];

const STATUS_TONES: Record<string, BadgeTone> = {
  Created: "gray",
  GeneratingOutline: "blue",
  DraftReady: "emerald",
  InReview: "amber",
  Approved: "emerald",
  Rejected: "red",
  Failed: "red",
};

const SITE_OPTIONS = [
  { value: "laruki", label: "laruki.com (thời trang)" },
  { value: "dochoi3s", label: "dochoi3s.com (đồ chơi)" },
  { value: "dichoithoi", label: "dichoithoi.com (du lịch)" },
];
const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "openai", label: "OpenAI" },
];

export default function ContentPage() {
  const queryClient = useQueryClient();

  // --- Filter man quan ly (khong con tao job AI tai day — moi site da co trang
  // rieng: /laruki/new, /dochoi3s/new, /dichoithoi/articles/new + [slug]?tab=ai-tools) ---
  const [filterSite, setFilterSite] = useState("");
  const [filterArticleType, setFilterArticleType] = useState("");
  const [filterProvider, setFilterProvider] = useState("");

  // --- Form "Viết tay" (bo qua AI) — giu lai vi chua co noi thay the ---
  const [topic, setTopic] = useState("");
  const [siteCode, setSiteCode] = useState("laruki");
  const [articleType, setArticleType] = useState<ArticleType>("toplist");
  const [keywords, setKeywords] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["content-jobs", filterSite, filterArticleType, filterProvider],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterSite) params.set("siteCode", filterSite);
      if (filterArticleType) params.set("articleType", filterArticleType);
      if (filterProvider) params.set("aiProvider", filterProvider);
      const qs = params.toString();
      return apiGet(`/content/jobs${qs ? `?${qs}` : ""}`, jobsListSchema);
    },
    // Poll 3s khi co job dang generate, 15s khi yen
    refetchInterval: (query) =>
      query.state.data?.some((j) => ACTIVE_STATUSES.includes(j.status)) ? 3000 : 15000,
  });

  const retryJob = useMutation({
    mutationFn: (jobId: string) => apiSend("POST", `/content/jobs/${jobId}/retry`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["content-jobs"] }),
  });

  /** Tao draft VIET TAY — bo qua AI, di thang DraftReady (article-spec §1.1) */
  const createManualDraft = useMutation({
    mutationFn: () =>
      apiSend("POST", "/content/jobs/manual", {
        siteCode,
        sourceRef: "manual",
        topic,
        articleType,
        keywordSeed: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setTopic("");
      setKeywords("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["content-jobs"] });
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError ? `${error.message}: ${error.details.join("; ")}` : String(error),
      );
    },
  });

  return (
    <div className="max-w-4xl space-y-8">
      <h2 className="text-2xl font-semibold">AI Content</h2>
      <p className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
        Trang này để <strong>xem/quản lý</strong> mọi bài viết AI toàn hệ thống — <strong>tạo bài mới</strong> làm
        ở trang riêng của từng site: <a href="/laruki/new" className="underline">laruki.com</a>,{" "}
        <a href="/dochoi3s/new" className="underline">dochoi3s.com</a>,{" "}
        <a href="/dichoithoi/articles/new" className="underline">dichoithoi.com</a> (hoặc tab &quot;AI hỗ
        trợ&quot; trên trang chi tiết điểm đến). Form &quot;Viết tay&quot; bên dưới vẫn giữ ở đây vì
        laruki/dochoi3s chưa có nơi khác làm việc này.
      </p>

      {/* Filter danh sach */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Website</span>
          <Select value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
            <option value="">Tất cả</option>
            {SITE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Loại bài viết</span>
          <Input
            value={filterArticleType}
            onChange={(e) => setFilterArticleType(e.target.value)}
            placeholder="vd: toplist, guide-diem-den, km-tin-tuc"
            className="w-56"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">AI Provider</span>
          <Select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}>
            <option value="">Tất cả</option>
            {PROVIDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        {(filterSite || filterArticleType || filterProvider) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilterSite("");
              setFilterArticleType("");
              setFilterProvider("");
            }}
          >
            Xoá lọc
          </Button>
        )}
      </div>

      {/* Form "Viet tay" — giu lai, chua co trang rieng thay the cho laruki/dochoi3s */}
      <details className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer select-none font-medium">✍️ Tạo draft viết tay (bỏ qua AI)</summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Website</span>
              <Select value={siteCode} onChange={(e) => setSiteCode(e.target.value)} className="w-full">
                <option value="laruki">laruki.com (thời trang)</option>
                <option value="dochoi3s">dochoi3s.com (đồ chơi)</option>
              </Select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Loại bài viết</span>
              <Select
                value={articleType}
                onChange={(e) => setArticleType(e.target.value as ArticleType)}
                className="w-full"
              >
                <option value="toplist">Top-list (danh sách sản phẩm tốt nhất)</option>
                <option value="review">Review một sản phẩm</option>
              </Select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Chủ đề bài viết</span>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="VD: Top 5 túi xách nữ da thật dưới 2 triệu"
              required
              minLength={5}
              className="w-full"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Từ khóa SEO (phân cách bằng dấu phẩy)</span>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="VD: túi xách nữ, túi da thật"
              className="w-full"
            />
          </label>

          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

          <Button
            type="button"
            variant="secondary"
            loading={createManualDraft.isPending}
            disabled={topic.trim().length < 5}
            onClick={() => createManualDraft.mutate()}
          >
            {createManualDraft.isPending ? "Đang tạo..." : "✍️ Viết tay"}
          </Button>
          <p className="text-xs text-zinc-500">
            Tạo ngay 1 khung bài gợi ý cấu trúc (không qua AI) để bạn tự viết — sau đó vẫn qua đủ các bước
            sửa/duyệt/publish như bài AI.
          </p>
        </div>
      </details>

      {/* Danh sach jobs */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <h3 className="border-b border-zinc-200 p-4 font-medium dark:border-zinc-800">
          Danh sách bài viết
        </h3>
        {jobsQuery.isLoading && <p className="p-4 text-sm text-zinc-500">Đang tải...</p>}
        {jobsQuery.isError && (
          <p className="p-4 text-sm text-red-600">Không tải được danh sách: {String(jobsQuery.error)}</p>
        )}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(jobsQuery.data ?? []).map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <a
                  href={`/content/${job.id}`}
                  className="block truncate font-medium hover:underline"
                >
                  {job.topic}
                </a>
                <p className="text-xs text-zinc-500">
                  {job.siteCode} · {job.articleType} · {job.aiProvider}/{job.aiModel} ·{" "}
                  {new Date(job.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {job.status === "Failed" && (
                  <Button size="sm" loading={retryJob.isPending} onClick={() => retryJob.mutate(job.id)}>
                    {retryJob.isPending ? "Đang gửi..." : "Thử lại"}
                  </Button>
                )}
                <Badge
                  tone={STATUS_TONES[job.status] ?? "gray"}
                  className={job.status === "GeneratingOutline" ? "animate-pulse" : undefined}
                >
                  {job.status}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
        {jobsQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">Chưa có bài viết nào khớp bộ lọc.</p>
        )}
      </div>
    </div>
  );
}
