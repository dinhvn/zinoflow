"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { contentJobSchema, type ContentJobStatus } from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button, buttonClasses } from "@/shared/ui/button";
import { PageHeader } from "@/shared/ui/page-header";

const jobsListSchema = z.array(contentJobSchema);

/** Job dang chay thi poll nhanh; xong het thi poll cham — cung nguong voi /content. */
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

/**
 * Danh sach bai cam nang dichoithoi (dichoithoi-article-spec §1, §9) — tach rieng
 * khoi /content (tron chung laruki/dochoi3s) bang cach loc siteCode "dichoithoi"
 * tren cung 1 nguon du lieu ContentJob, khong them bang/API rieng.
 */
export default function DichoithoiArticlesPage() {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ["content-jobs"],
    queryFn: () => apiGet("/content/jobs", jobsListSchema),
    refetchInterval: (query) =>
      query.state.data?.some((j) => j.siteCode === "dichoithoi" && ACTIVE_STATUSES.includes(j.status))
        ? 3000
        : 15000,
  });

  const retryJob = useMutation({
    mutationFn: (jobId: string) => apiSend("POST", `/content/jobs/${jobId}/retry`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["content-jobs"] }),
  });

  const articles = (jobsQuery.data ?? []).filter((job) => job.siteCode === "dichoithoi");

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title="Bài cẩm nang — dichoithoi.com"
        description="Bài tổng hợp (khác bài giới thiệu 1 điểm đến) — gom nhiều điểm đến/khách sạn/tour theo chủ đề."
        actions={
          <a href="/dichoithoi/articles/new" className={buttonClasses({ variant: "primary" })}>
            + Bài cẩm nang mới
          </a>
        }
      />

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        {jobsQuery.isLoading && <p className="p-4 text-sm text-zinc-500">Đang tải...</p>}
        {jobsQuery.isError && (
          <p className="p-4 text-sm text-red-600">
            Không tải được danh sách: {String(jobsQuery.error)}
          </p>
        )}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {articles.map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <a href={`/content/${job.id}`} className="block truncate font-medium hover:underline">
                  {job.topic}
                </a>
                <p className="text-xs text-zinc-500">
                  {job.aiProvider}/{job.aiModel} · {new Date(job.createdAt).toLocaleString("vi-VN")}
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
        {!jobsQuery.isLoading && articles.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">Chưa có bài cẩm nang nào.</p>
        )}
      </div>
    </div>
  );
}
