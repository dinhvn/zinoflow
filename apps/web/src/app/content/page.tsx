"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  contentJobSchema,
  listAiProvidersResponseSchema,
  type ArticleType,
  type ContentJobStatus,
  type CreateContentJobRequest,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";

const jobsListSchema = z.array(contentJobSchema);

/** Job dang chay thi poll nhanh; xong het thi poll cham. */
const ACTIVE_STATUSES: ContentJobStatus[] = ["Created", "GeneratingOutline"];

const STATUS_STYLES: Record<string, string> = {
  Created: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  GeneratingOutline: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse",
  DraftReady: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  InReview: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function ContentPage() {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [siteCode, setSiteCode] = useState("laruki");
  const [articleType, setArticleType] = useState<ArticleType>("toplist");
  const [keywords, setKeywords] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
  });

  const jobsQuery = useQuery({
    queryKey: ["content-jobs"],
    queryFn: () => apiGet("/content/jobs", jobsListSchema),
    // Poll 3s khi co job dang generate, 15s khi yen
    refetchInterval: (query) =>
      query.state.data?.some((j) => ACTIVE_STATUSES.includes(j.status)) ? 3000 : 15000,
  });

  // Provider kha dung: co key + dang bat. Provider dau tien lam default.
  const usableProviders = (providersQuery.data?.providers ?? []).filter(
    (p) => p.isConfigured && p.isEnabled && p.models.length > 0,
  );
  const selectedProvider =
    usableProviders.find((p) => p.key === provider) ?? usableProviders[0] ?? null;
  const selectedModel =
    selectedProvider?.models.find((m) => m.id === model) ?? selectedProvider?.models[0] ?? null;

  const retryJob = useMutation({
    mutationFn: (jobId: string) => apiSend("POST", `/content/jobs/${jobId}/retry`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["content-jobs"] }),
  });

  const createJob = useMutation({
    mutationFn: (request: CreateContentJobRequest) => apiSend("POST", "/content/jobs", request),
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider || !selectedModel) {
      setFormError("Chưa có AI provider khả dụng — kiểm tra Settings và API key");
      return;
    }
    createJob.mutate({
      siteCode,
      sourceType: "Topic",
      sourceRef: "manual",
      topic,
      articleType,
      keywordSeed: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      aiProvider: selectedProvider.key,
      aiModel: selectedModel.id,
    });
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h2 className="text-2xl font-semibold">AI Content</h2>

      {/* Form tao job */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h3 className="font-medium">Tạo bài viết mới</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Website</span>
            <select
              value={siteCode}
              onChange={(e) => setSiteCode(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
            >
              <option value="laruki">laruki.com (thời trang)</option>
              <option value="dochoi3s">dochoi3s.com (đồ chơi)</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">Loại bài viết</span>
            <select
              value={articleType}
              onChange={(e) => setArticleType(e.target.value as ArticleType)}
              className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
            >
              <option value="toplist">Top-list (danh sách sản phẩm tốt nhất)</option>
              <option value="review">Review một sản phẩm</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-500">AI Provider / Model</span>
            <div className="flex gap-2">
              <select
                value={selectedProvider?.key ?? ""}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel(""); // reset model khi doi provider
                }}
                className="w-1/2 rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
              >
                {usableProviders.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.displayName}
                  </option>
                ))}
              </select>
              <select
                value={selectedModel?.id ?? ""}
                onChange={(e) => setModel(e.target.value)}
                className="w-1/2 rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
              >
                {(selectedProvider?.models ?? []).map((m) => (
                  <option key={m.id} value={m.id} title={m.costNote}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            {selectedModel?.costNote && (
              <span className="mt-1 block text-xs text-zinc-400">{selectedModel.costNote}</span>
            )}
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Chủ đề bài viết</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="VD: Top 5 túi xách nữ da thật dưới 2 triệu"
            required
            minLength={5}
            className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Từ khóa SEO (phân cách bằng dấu phẩy)</span>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="VD: túi xách nữ, túi da thật"
            className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
          />
        </label>

        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={createJob.isPending || !selectedProvider}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {createJob.isPending ? "Đang tạo..." : "Tạo bài viết"}
        </button>
      </form>

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
                  {job.siteCode} · {job.aiProvider}/{job.aiModel} ·{" "}
                  {new Date(job.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {job.status === "Failed" && (
                  <button
                    type="button"
                    onClick={() => retryJob.mutate(job.id)}
                    disabled={retryJob.isPending}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    {retryJob.isPending ? "Đang gửi..." : "Thử lại"}
                  </button>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status] ?? ""}`}
                >
                  {job.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {jobsQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">Chưa có bài viết nào.</p>
        )}
      </div>
    </div>
  );
}
