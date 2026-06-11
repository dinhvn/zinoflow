"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod/v4";
import { contentJobSchema } from "@zinoflow/contracts";
import { apiGet, ApiError } from "@/shared/api-client";

/** Draft response tu GET /content/jobs/:id/draft (DraftRecord phia API). */
const draftSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  version: z.number(),
  title: z.string().nullable(),
  draftMarkdown: z.string().nullable(),
});

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const jobQuery = useQuery({
    queryKey: ["content-job", id],
    queryFn: () => apiGet(`/content/jobs/${id}`, contentJobSchema),
    // Poll khi dang generate de tu hien draft luc xong
    refetchInterval: (query) =>
      query.state.data && ["Created", "GeneratingOutline"].includes(query.state.data.status)
        ? 3000
        : false,
  });

  const job = jobQuery.data;
  const hasDraft = job && !["Created", "GeneratingOutline", "Failed"].includes(job.status);

  const draftQuery = useQuery({
    queryKey: ["content-draft", id],
    queryFn: () => apiGet(`/content/jobs/${id}/draft`, draftSchema),
    enabled: Boolean(hasDraft),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });

  return (
    <div className="max-w-4xl space-y-6">
      <a href="/content" className="text-sm text-zinc-500 hover:underline">
        ← Quay lai danh sach
      </a>

      {jobQuery.isLoading && <p className="text-sm text-zinc-500">Dang tai...</p>}

      {job && (
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="mb-2 text-xl font-semibold">{job.topic}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-500">
            <span>Status: <strong className="text-zinc-900 dark:text-zinc-100">{job.status}</strong></span>
            <span>Site: {job.siteCode}</span>
            <span>AI: {job.aiProvider}/{job.aiModel}</span>
            <span>Tao: {new Date(job.createdAt).toLocaleString("vi-VN")}</span>
          </div>
          {job.status === "GeneratingOutline" && (
            <p className="mt-2 animate-pulse text-blue-600 dark:text-blue-400">
              AI dang viet bai... (tu dong cap nhat)
            </p>
          )}
          {job.status === "Failed" && (
            <p className="mt-2 text-red-600 dark:text-red-400">
              Generate that bai — he thong se tu retry, hoac kiem tra log API.
            </p>
          )}
        </div>
      )}

      {hasDraft && draftQuery.data && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="font-medium">Draft v{draftQuery.data.version}</h3>
            {/* M3: nut Approve/Reject + quality gates checklist se nam o day */}
            <span className="text-xs text-zinc-400">Review workflow: M3</span>
          </div>
          {/* M3 se render HTML + editor; hien tai xem markdown tho */}
          <pre className="overflow-x-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed">
            {draftQuery.data.draftMarkdown ?? "(chua co noi dung)"}
          </pre>
        </div>
      )}
    </div>
  );
}
