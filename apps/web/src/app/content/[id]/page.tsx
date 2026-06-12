"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  contentJobSchema,
  draftArticleSchema,
  runQualityChecksResponseSchema,
  type ReviewAction,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";

/** Draft response tu GET /content/jobs/:id/draft (DraftRecord phia API). */
const draftSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  version: z.number(),
  title: z.string().nullable(),
  draftMarkdown: z.string().nullable(),
  /** Bai structured — dung cho panel quick-facts bai diem den */
  article: draftArticleSchema.nullable().catch(null),
});

const htmlSchema = z.object({ draftId: z.string(), html: z.string() });

const reviewHistorySchema = z.array(
  z.object({
    id: z.string(),
    action: z.enum(["Approve", "RequestChange", "Reject"]),
    note: z.string().nullable(),
    actor: z.string(),
    createdAt: z.string(),
    draftVersion: z.number(),
  }),
);

const versionsSchema = z.array(
  z.object({
    id: z.string(),
    version: z.number(),
    title: z.string().nullable(),
    createdAt: z.string(),
  }),
);

const GATE_LABELS: Record<string, string> = {
  structure: "Cấu trúc bài viết",
  seo: "SEO",
  policy: "Chính sách nội dung",
  data: "Dữ liệu sản phẩm",
};

const ACTION_LABELS: Record<string, string> = {
  Approve: "Đã duyệt",
  RequestChange: "Yêu cầu sửa",
  Reject: "Từ chối",
};

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [editorText, setEditorText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

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
  const draft = draftQuery.data;

  // Dong bo editor moi khi load draft/version moi (khong ghi de khi dang go)
  useEffect(() => {
    if (draft?.draftMarkdown != null) setEditorText(draft.draftMarkdown);
  }, [draft?.id, draft?.draftMarkdown]);

  const htmlQuery = useQuery({
    queryKey: ["draft-html", draft?.id],
    queryFn: () => apiGet(`/content/drafts/${draft!.id}/html`, htmlSchema),
    enabled: Boolean(draft?.id),
  });

  const checksQuery = useQuery({
    queryKey: ["draft-checks", draft?.id],
    queryFn: () => apiGet(`/content/drafts/${draft!.id}/quality-checks`, runQualityChecksResponseSchema),
    enabled: Boolean(draft?.id),
  });

  const reviewsQuery = useQuery({
    queryKey: ["job-reviews", id],
    queryFn: () => apiGet(`/content/jobs/${id}/reviews`, reviewHistorySchema),
    enabled: Boolean(hasDraft),
  });

  const versionsQuery = useQuery({
    queryKey: ["job-drafts", id],
    queryFn: () => apiGet(`/content/jobs/${id}/drafts`, versionsSchema),
    enabled: Boolean(hasDraft),
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ["content-job", id] });
    void queryClient.invalidateQueries({ queryKey: ["content-draft", id] });
    void queryClient.invalidateQueries({ queryKey: ["job-reviews", id] });
    void queryClient.invalidateQueries({ queryKey: ["job-drafts", id] });
    void queryClient.invalidateQueries({ queryKey: ["draft-html"] });
    void queryClient.invalidateQueries({ queryKey: ["draft-checks"] });
  }

  function toActionError(error: unknown) {
    return error instanceof ApiError
      ? { message: error.message, details: error.details }
      : { message: String(error), details: [] };
  }

  const saveDraft = useMutation({
    mutationFn: () => apiSend("PUT", `/content/drafts/${draft!.id}`, { draftMarkdown: editorText }),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const runChecks = useMutation({
    mutationFn: () => apiSend("POST", `/content/drafts/${draft!.id}/quality-checks`, {}),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["draft-checks"] });
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const submitReview = useMutation({
    mutationFn: () => apiSend("POST", `/content/jobs/${id}/submit-review`, {}),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const review = useMutation({
    mutationFn: (action: ReviewAction) =>
      apiSend("POST", `/content/drafts/${draft!.id}/review`, {
        action,
        note: reviewNote.trim() || undefined,
      }),
    onSuccess: () => {
      setActionError(null);
      setReviewNote("");
      invalidateAll();
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const isDirty = draft?.draftMarkdown != null && editorText !== draft.draftMarkdown;
  const checks = checksQuery.data?.checks ?? [];

  return (
    <div className="max-w-6xl space-y-6">
      <a href="/content" className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>

      {jobQuery.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}

      {job && (
        <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="mb-2 text-xl font-semibold">{job.topic}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-500">
            <span>
              Trạng thái: <strong className="text-zinc-900 dark:text-zinc-100">{job.status}</strong>
            </span>
            <span>Site: {job.siteCode}</span>
            <span>
              Loại bài:{" "}
              {job.articleType === "toplist"
                ? "Top-list"
                : job.articleType === "review"
                  ? "Review đơn"
                  : "Điểm đến (dichoithoi)"}
            </span>
            <span>AI: {job.aiProvider}/{job.aiModel}</span>
            {draft && <span>Version: v{draft.version}</span>}
          </div>
          {job.status === "GeneratingOutline" && (
            <p className="mt-2 animate-pulse text-blue-600 dark:text-blue-400">
              AI đang viết bài... (tự động cập nhật)
            </p>
          )}
          {job.status === "Failed" && (
            <p className="mt-2 text-red-600 dark:text-red-400">
              Tạo bài thất bại — bấm Thử lại ở trang danh sách hoặc kiểm tra log API.
            </p>
          )}
          {job.status === "Approved" && (
            <p className="mt-2 text-emerald-600 dark:text-emerald-400">
              Bài đã được duyệt. Sửa nội dung sẽ tạo version mới và phải duyệt lại.
            </p>
          )}

          {/* Thanh hanh dong theo trang thai */}
          {hasDraft && draft && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {job.status === "DraftReady" && (
                <button
                  onClick={() => submitReview.mutate()}
                  disabled={submitReview.isPending || isDirty}
                  title={isDirty ? "Lưu nội dung trước khi gửi duyệt" : undefined}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Gửi duyệt
                </button>
              )}
              {job.status === "InReview" && (
                <>
                  <button
                    onClick={() => review.mutate("Approve")}
                    disabled={review.isPending}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Duyệt bài
                  </button>
                  <button
                    onClick={() => review.mutate("RequestChange")}
                    disabled={review.isPending}
                    className="rounded border border-amber-500 px-3 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50 dark:hover:bg-amber-950"
                  >
                    Yêu cầu sửa
                  </button>
                  <button
                    onClick={() => review.mutate("Reject")}
                    disabled={review.isPending}
                    className="rounded border border-red-500 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
                  >
                    Từ chối
                  </button>
                  <input
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Ghi chú review (bắt buộc khi từ chối)"
                    className="min-w-64 flex-1 rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                  />
                </>
              )}
            </div>
          )}

          {actionError && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              <p className="font-medium">{actionError.message}</p>
              {actionError.details.length > 0 && (
                <ul className="mt-1 list-inside list-disc">
                  {actionError.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick facts — bai diem den: phan du lieu de sai nhat, can duyet tay ky
          (dichoithoi-destination-spec §7.5). Khi publish se do vao cot rieng tren web. */}
      {job?.articleType === "guide-diem-den" &&
        draft?.article &&
        "quickFacts" in draft.article && (
          <div className="rounded-lg border-2 border-amber-300 p-4 dark:border-amber-700">
            <h3 className="mb-2 font-medium text-amber-700 dark:text-amber-300">
              ⚠️ Thông tin nhanh — kiểm tra tay trước khi duyệt (giá vé, giờ mở cửa dễ sai)
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              {(
                [
                  ["Giờ mở cửa", draft.article.quickFacts.openingTime],
                  ["Giá vé", draft.article.quickFacts.ticketPrice],
                  ["Di chuyển", draft.article.quickFacts.transport],
                  ["Ăn uống", draft.article.quickFacts.food],
                  ["Lưu trú", draft.article.quickFacts.hotel],
                  ["Mẹo & lưu ý", draft.article.quickFacts.tip],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="font-medium text-zinc-500">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div>
                <dt className="font-medium text-zinc-500">Dòng cập nhật</dt>
                <dd>{draft.article.updateNotice}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500">Slug gợi ý</dt>
                <dd className="font-mono">{draft.article.metadata.slugSuggestion}</dd>
              </div>
            </dl>
          </div>
        )}

      {/* Quality gates */}
      {hasDraft && draft && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Kiểm tra chất lượng (4 gates)</h3>
            <button
              onClick={() => runChecks.mutate()}
              disabled={runChecks.isPending}
              className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {runChecks.isPending ? "Đang kiểm tra..." : "Chạy kiểm tra"}
            </button>
          </div>
          {checks.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Chưa chạy kiểm tra cho version này. Bấm &quot;Chạy kiểm tra&quot; — bài chỉ duyệt được
              khi cả 4 gate đạt.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {checks.map((check) => (
                <li key={check.gateName} className="flex gap-2">
                  <span>{check.passed ? "✅" : "❌"}</span>
                  <div>
                    <span className="font-medium">
                      {GATE_LABELS[check.gateName] ?? check.gateName}
                    </span>
                    {check.details.length > 0 && (
                      <ul className="mt-1 list-inside list-disc text-red-600 dark:text-red-400">
                        {check.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Editor | Preview 2 cot */}
      {hasDraft && draft && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-medium">Soạn thảo (Markdown)</h3>
              <button
                onClick={() => saveDraft.mutate()}
                disabled={!isDirty || saveDraft.isPending}
                className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {saveDraft.isPending ? "Đang lưu..." : isDirty ? "Lưu (tạo version mới)" : "Đã lưu"}
              </button>
            </div>
            <textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              spellCheck={false}
              className="h-[600px] w-full resize-y bg-transparent p-3 font-mono text-sm leading-relaxed focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
              <h3 className="text-sm font-medium">Xem trước (HTML đã làm sạch)</h3>
            </div>
            <div
              className="prose prose-zinc dark:prose-invert h-[600px] max-w-none overflow-y-auto p-4 text-sm
                [&_a]:text-blue-600 [&_a]:underline [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold
                [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc"
              // HTML da duoc sanitize phia API (sanitize-html) truoc khi tra ve
              dangerouslySetInnerHTML={{ __html: htmlQuery.data?.html ?? "<p>Đang tải...</p>" }}
            />
          </div>
        </div>
      )}

      {/* Lich su review + versions */}
      {hasDraft && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-3 font-medium">Lịch sử review</h3>
            {(reviewsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-zinc-500">Chưa có hành động review nào.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {reviewsQuery.data!.map((r) => (
                  <li key={r.id} className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800">
                    <span className="font-medium">{ACTION_LABELS[r.action] ?? r.action}</span>
                    <span className="text-zinc-500">
                      {" "}· v{r.draftVersion} · {r.actor} ·{" "}
                      {new Date(r.createdAt).toLocaleString("vi-VN")}
                    </span>
                    {r.note && <p className="mt-1 text-zinc-600 dark:text-zinc-400">“{r.note}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-3 font-medium">Các version</h3>
            <ul className="space-y-1 text-sm">
              {(versionsQuery.data ?? []).map((v) => (
                <li key={v.id} className="text-zinc-600 dark:text-zinc-400">
                  <span className={v.id === draft?.id ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>
                    v{v.version}
                  </span>{" "}
                  · {new Date(v.createdAt).toLocaleString("vi-VN")}
                  {v.id === draft?.id && " (hiện tại)"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
