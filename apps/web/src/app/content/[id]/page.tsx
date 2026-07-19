"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  aiUsageLogEntrySchema,
  contentJobSchema,
  type AiUsageLogEntry,
  destinationDetailSchema,
  draftArticleSchema,
  listAiProvidersResponseSchema,
  publishArticleResultSchema,
  publishDestinationResultSchema,
  refreshDynamicBlocksResultSchema,
  runQualityChecksResponseSchema,
  type DestinationArticle,
  type PublishArticleResult,
  type PublishDestinationResult,
  type RefreshDynamicBlocksResult,
  type ReviewAction,
  type UpdateContentJobRequest,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { InsertDynamicBlockPanel } from "@/features/dichoithoi/insert-dynamic-block-panel";
import { ArticleDestinationMapPanel } from "@/features/dichoithoi/article-destination-map-panel";
import { DestinationArticleEditor } from "@/features/dichoithoi/destination-article-editor/destination-article-editor";

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

/**
 * Nhan hien thi chi tiet cho 1 lan goi AI trong "Lich su goi AI" — thay vi chi
 * "section:1" trơ trụi thi hien "section:1 · Tổng quan" (parse tu responseText
 * da luu, khong goi API them). Parse loi/thieu field thi fallback ve operation goc.
 */
function describeUsageLogOperation(operation: string, responseText: string | null): string {
  if (!responseText) return operation;
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return operation;
  }
  if (typeof parsed !== "object" || parsed === null) return operation;
  const record = parsed as Record<string, unknown>;
  if (/^section:\d+$/.test(operation) && typeof record.heading === "string") {
    return `${operation} · ${record.heading}`;
  }
  if (operation === "outline" && typeof record.title === "string") {
    return `${operation} · ${record.title}`;
  }
  if (operation === "frame" && typeof record.hero === "object" && record.hero !== null) {
    const hero = record.hero as Record<string, unknown>;
    if (typeof hero.title === "string") return `${operation} · ${hero.title}`;
  }
  return operation;
}

/**
 * Gom "Lịch sử gọi AI" (danh sách phẳng theo thời gian) thành TỪNG LẦN CHẠY —
 * mỗi lần chạy luôn bắt đầu bằng 1 lệnh "outline" (xem generate-content.usecase.ts),
 * nên tách nhóm mới mỗi khi gặp operation "outline". Yêu cầu người dùng 07/2026:
 * trước đây danh sách phẳng lẫn lộn nhiều lần chạy (kể cả lần lỗi giữa chừng),
 * không phân biệt được lần nào tạo ra version nào.
 */
function groupUsageLogsByRun(logs: AiUsageLogEntry[]): AiUsageLogEntry[][] {
  const groups: AiUsageLogEntry[][] = [];
  for (const log of logs) {
    if (log.operation === "outline" || groups.length === 0) {
      groups.push([log]);
    } else {
      groups[groups.length - 1]!.push(log);
    }
  }
  return groups;
}

/** Version nao duoc tao ra tu 1 lan chay — khop theo createdAt nam trong khoang [dau lan chay, dau lan chay ke tiep). */
function findVersionForRun(
  group: AiUsageLogEntry[],
  nextRunStart: string | undefined,
  versions: { version: number; createdAt: string }[],
): number | null {
  const runStart = new Date(group[0]!.createdAt).getTime();
  const boundEnd = nextRunStart ? new Date(nextRunStart).getTime() : Infinity;
  const match = versions.find((v) => {
    const t = new Date(v.createdAt).getTime();
    return t >= runStart && t < boundEnd;
  });
  return match?.version ?? null;
}

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
  const [articleDraft, setArticleDraft] = useState<DestinationArticle | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<{ message: string; details: string[] } | null>(
    null,
  );

  // Form sua tham so sinh bai (chi mo khi job Failed/DraftReady)
  const [editOpen, setEditOpen] = useState(false);
  const [editTopic, setEditTopic] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [editProvider, setEditProvider] = useState("");
  const [editModel, setEditModel] = useState("");

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

  // Gate thumbnail (redesign luong viet bai §Phase 4) — publish-destination.usecase.ts bat buoc
  // co thumbnail, truoc day chi bao loi runtime; gio kiem tra + hien ro tren UI truoc khi cho bam.
  const isDestinationApproved = job?.articleType === "guide-diem-den" && job.status === "Approved";
  const destinationQuery = useQuery({
    queryKey: ["destination-detail-thumbnail", job?.sourceRef],
    queryFn: () => apiGet(`/destinations/${job!.sourceRef}`, destinationDetailSchema),
    enabled: Boolean(isDestinationApproved),
  });
  const missingThumbnail = isDestinationApproved && !destinationQuery.data?.thumbnail;
  // Chi sua tham so + chay lai duoc khi job Failed hoac DraftReady (dong bo state machine BE)
  const canEditParams = job && ["Failed", "DraftReady"].includes(job.status);

  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
    enabled: Boolean(canEditParams),
  });
  const usableProviders = (providersQuery.data?.providers ?? []).filter(
    (p) => p.isConfigured && p.isEnabled && p.models.length > 0,
  );
  const editSelectedProvider =
    usableProviders.find((p) => p.key === editProvider) ?? usableProviders[0] ?? null;
  const editSelectedModel =
    editSelectedProvider?.models.find((m) => m.id === editModel) ??
    editSelectedProvider?.models[0] ??
    null;

  // Prefill form khi mo (dung gia tri hien tai cua job)
  function openEditForm() {
    if (!job) return;
    setEditTopic(job.topic);
    setEditKeywords(job.keywordSeed.join(", "));
    setEditProvider(job.aiProvider);
    setEditModel(job.aiModel);
    setActionError(null);
    setEditOpen(true);
  }

  const draftQuery = useQuery({
    queryKey: ["content-draft", id],
    queryFn: () => apiGet(`/content/jobs/${id}/draft`, draftSchema),
    enabled: Boolean(hasDraft),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const draft = draftQuery.data;
  const isDestination = job?.articleType === "guide-diem-den";

  // Dong bo editor moi khi load draft/version moi (khong ghi de khi dang go)
  useEffect(() => {
    if (draft?.draftMarkdown != null) setEditorText(draft.draftMarkdown);
    if (draft?.article && "quickFacts" in draft.article) setArticleDraft(draft.article);
  }, [draft?.id, draft?.draftMarkdown, draft?.article]);

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

  // Lich su goi AI (prompt/response tho tung buoc) — yeu cau nguoi dung 07/2026 de debug/audit
  // + xem TIEN DO THAT khi dang chay (moi lan goi AI ghi vao DB NGAY, khong doi xong het):
  // bat song song voi jobQuery ngay ca luc dang GeneratingOutline, tu lam moi 3s toi khi xong.
  const usageLogsQuery = useQuery({
    queryKey: ["job-usage-logs", id],
    queryFn: () => apiGet(`/content/jobs/${id}/usage-logs`, z.array(aiUsageLogEntrySchema)),
    enabled: Boolean(job),
    refetchInterval: () => (job && ["Created", "GeneratingOutline"].includes(job.status) ? 3000 : false),
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
    mutationFn: () =>
      isDestination
        ? apiSend("PUT", `/content/drafts/${draft!.id}`, { article: articleDraft })
        : apiSend("PUT", `/content/drafts/${draft!.id}`, { draftMarkdown: editorText }),
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

  // Sua tham so job roi chay lai: PATCH cap nhat -> POST retry (2 buoc, tach bach).
  const editAndRerun = useMutation({
    mutationFn: async () => {
      const body: UpdateContentJobRequest = {
        topic: editTopic.trim(),
        keywordSeed: editKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        aiProvider: editSelectedProvider?.key,
        aiModel: editSelectedModel?.id,
      };
      await apiSend("PATCH", `/content/jobs/${id}`, body);
      await apiSend("POST", `/content/jobs/${id}/retry`, {});
    },
    onSuccess: () => {
      setActionError(null);
      setEditOpen(false);
      invalidateAll();
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  // Huy job dang chay ma bi "ket" (worker crash giua chung, khong tu chuyen Failed)
  const cancelJob = useMutation({
    mutationFn: () => apiSend("POST", `/content/jobs/${id}/cancel`, {}),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const [publishResult, setPublishResult] = useState<PublishDestinationResult | null>(null);
  // Gate thu cong thu 2 (Approve ≠ Publish): day bai da duyet xuong SQL Server dichoithoi
  const publishDichoithoi = useMutation({
    mutationFn: async () =>
      publishDestinationResultSchema.parse(
        await apiSend("POST", `/destinations/${job!.sourceRef}/publish`, {}),
      ),
    onSuccess: (result) => {
      setActionError(null);
      setPublishResult(result);
      invalidateAll();
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const [articleResult, setArticleResult] = useState<PublishArticleResult | null>(null);
  const publishArticle = useMutation({
    mutationFn: async () =>
      publishArticleResultSchema.parse(await apiSend("POST", `/articles/${id}/publish`, {})),
    onSuccess: (result) => {
      setActionError(null);
      setArticleResult(result);
      invalidateAll();
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const [refreshResult, setRefreshResult] = useState<RefreshDynamicBlocksResult | null>(null);
  const refreshBlocks = useMutation({
    mutationFn: async () =>
      refreshDynamicBlocksResultSchema.parse(
        await apiSend("POST", `/articles/${id}/refresh-blocks`, {}),
      ),
    onSuccess: (result) => {
      setActionError(null);
      setRefreshResult(result);
    },
    onError: (error) => setActionError(toActionError(error)),
  });

  const isDirty = isDestination
    ? articleDraft != null && JSON.stringify(articleDraft) !== JSON.stringify(draft?.article ?? null)
    : draft?.draftMarkdown != null && editorText !== draft.draftMarkdown;
  const checks = checksQuery.data?.checks ?? [];

  /** Chen 1 token khoi dong vao vi tri con tro trong textarea (article-spec §9) */
  function insertBlockToken(token: string) {
    const el = editorRef.current;
    const line = `\n${token}\n`;
    if (!el) {
      setEditorText((t) => `${t}${line}`);
      return;
    }
    const start = el.selectionStart ?? editorText.length;
    const end = el.selectionEnd ?? editorText.length;
    const next = `${editorText.slice(0, start)}${line}${editorText.slice(end)}`;
    setEditorText(next);
    const cursor = start + line.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

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
                  : job.articleType === "cam-nang"
                    ? "Cẩm nang (dichoithoi)"
                    : "Điểm đến (dichoithoi)"}
            </span>
            <span>AI: {job.aiProvider}/{job.aiModel}</span>
            {draft && <span>Version: v{draft.version}</span>}
          </div>
          {job.status === "GeneratingOutline" && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="animate-pulse text-blue-600 dark:text-blue-400">
                AI đang viết bài... (tự động cập nhật)
              </p>
              <Button
                size="sm"
                variant="secondary"
                loading={cancelJob.isPending}
                onClick={() => cancelJob.mutate()}
                title="Dùng khi job đứng im quá lâu (worker bị treo/crash) — chuyển về Thất bại để có thể Thử lại"
              >
                Hủy job (bị kẹt)
              </Button>
            </div>
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

          {/* Sua tham so sinh bai + chay lai (Failed/DraftReady) */}
          {canEditParams && (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              {!editOpen ? (
                <Button size="sm" variant="secondary" onClick={openEditForm}>
                  Sửa thông tin / chọn lại model & chạy lại
                </Button>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-zinc-500">Chủ đề bài viết</span>
                    <Input
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      minLength={5}
                      className="w-full"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-zinc-500">Từ khóa SEO (phân cách bằng dấu phẩy)</span>
                    <Input
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      placeholder="VD: túi xách nữ, túi da thật"
                      className="w-full"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-zinc-500">AI Provider / Model</span>
                    <div className="flex gap-2">
                      <Select
                        value={editSelectedProvider?.key ?? ""}
                        onChange={(e) => {
                          setEditProvider(e.target.value);
                          setEditModel(""); // reset model khi doi provider
                        }}
                        className="w-1/2"
                      >
                        {usableProviders.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.displayName}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={editSelectedModel?.id ?? ""}
                        onChange={(e) => setEditModel(e.target.value)}
                        className="w-1/2"
                      >
                        {(editSelectedProvider?.models ?? []).map((m) => (
                          <option key={m.id} value={m.id} title={m.costNote}>
                            {m.displayName}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {editSelectedModel?.costNote && (
                      <span className="mt-1 block text-xs text-zinc-400">
                        {editSelectedModel.costNote}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={editAndRerun.isPending}
                      disabled={editTopic.trim().length < 5 || !editSelectedModel}
                      onClick={() => editAndRerun.mutate()}
                    >
                      {editAndRerun.isPending ? "Đang lưu & chạy lại..." : "Lưu & chạy lại"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={editAndRerun.isPending}
                      onClick={() => setEditOpen(false)}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
              {job.status === "Approved" && job.articleType === "guide-diem-den" && (
                <>
                  <button
                    onClick={() => publishDichoithoi.mutate()}
                    disabled={publishDichoithoi.isPending || missingThumbnail}
                    title={
                      missingThumbnail
                        ? "Chưa có ảnh đại diện — vào trang Điểm đến để thêm ảnh trước khi đăng"
                        : undefined
                    }
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {publishDichoithoi.isPending ? "Đang đăng..." : "Đăng lên dichoithoi"}
                  </button>
                  {missingThumbnail && (
                    <a
                      href={`/dichoithoi/${job.sourceRef}`}
                      className="text-xs text-amber-600 hover:underline dark:text-amber-400"
                    >
                      ⚠️ Chưa có ảnh đại diện — vào trang Điểm đến để thêm ảnh
                    </a>
                  )}
                </>
              )}
              {job.status === "Approved" && job.articleType === "cam-nang" && (
                <Button
                  variant="primary"
                  loading={publishArticle.isPending}
                  onClick={() => publishArticle.mutate()}
                >
                  {publishArticle.isPending ? "Đang đăng..." : "Đăng bài cẩm nang"}
                </Button>
              )}
              {job.articleType === "cam-nang" && (
                <Button
                  variant="secondary"
                  loading={refreshBlocks.isPending}
                  onClick={() => refreshBlocks.mutate()}
                >
                  {refreshBlocks.isPending ? "Đang làm mới..." : "Làm mới khối động"}
                </Button>
              )}
            </div>
          )}

          {publishResult && (
            <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <p className="font-medium">
                ✅ Đã đăng bài “{publishResult.slug}” lên dichoithoi (
                {(publishResult.durationMs / 1000).toFixed(1)}s) — cập nhật khối liên quan cho{" "}
                {publishResult.relatedRecomputed} điểm đến.
              </p>
              {publishResult.addedLinks.length > 0 && (
                <p className="mt-1">
                  Link nội bộ đã chèn: {publishResult.addedLinks.map((l) => l.targetName).join(", ")}
                </p>
              )}
            </div>
          )}

          {articleResult && (
            <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <p className="font-medium">
                ✅ Đã đăng bài “{articleResult.slug}” ({(articleResult.durationMs / 1000).toFixed(1)}s) —{" "}
                {articleResult.blockCount} khối động.
              </p>
              {articleResult.warnings.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
                  {articleResult.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {articleResult && articleResult.addedLinks.length > 0 && (
            <ArticleDestinationMapPanel jobId={id} suggestions={articleResult.addedLinks} />
          )}

          {refreshResult && (
            <div className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <p className="font-medium">
                ✅ Đã làm mới khối động cho “{refreshResult.slug}” — {refreshResult.blockCount} khối.
              </p>
              {refreshResult.warnings.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
                  {refreshResult.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
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
              <h3 className="text-sm font-medium">
                {isDestination ? "Soạn thảo (từng khối)" : "Soạn thảo (Markdown)"}
              </h3>
              <div className="flex items-center gap-2">
                {job?.articleType === "cam-nang" && (
                  <InsertDynamicBlockPanel onInsert={insertBlockToken} />
                )}
                <button
                  onClick={() => saveDraft.mutate()}
                  disabled={!isDirty || saveDraft.isPending}
                  className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {saveDraft.isPending ? "Đang lưu..." : isDirty ? "Lưu (tạo version mới)" : "Đã lưu"}
                </button>
              </div>
            </div>
            {isDestination && articleDraft ? (
              <DestinationArticleEditor article={articleDraft} onChange={setArticleDraft} />
            ) : (
              <textarea
                ref={editorRef}
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                spellCheck={false}
                className="h-[600px] w-full resize-y bg-transparent p-3 font-mono text-sm leading-relaxed focus:outline-none"
              />
            )}
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

      {/* Lich su goi AI — moi buoc outline/section/frame, xem duoc prompt da gui + response tho.
          Hien NGAY CA luc dang GeneratingOutline (khong doi hasDraft) — moi lan goi AI ghi DB
          ngay sau khi xong, nen danh sach nay TU DAI RA theo thoi gian thuc trong luc cho, thay
          vi doi ca pipeline xong moi thay gi do (yeu cau nguoi dung 07/2026: "chay toi dau thay
          toi do"). */}
      {job && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">Lịch sử gọi AI</h3>
            {(usageLogsQuery.data ?? []).length > 0 && (
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Tổng chi phí: $
                {usageLogsQuery.data!.reduce((sum, log) => sum + log.costUsd, 0).toFixed(4)}
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-zinc-500">
            Mỗi lần AI được gọi (mỗi bước outline/từng khối/frame) — bấm mở để xem đúng nội dung
            prompt đã gửi và response thô AI trả về, dùng để kiểm tra vì sao bài ra như vậy.
          </p>
          {["Created", "GeneratingOutline"].includes(job.status) && (
            <p className="mb-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
              Đang chạy — đã xong {usageLogsQuery.data?.length ?? 0} lệnh gọi (outline + 7 khối +
              frame = 9 lệnh cho bài điểm đến, ít hơn cho loại bài khác), danh sách bên dưới tự cập
              nhật.
            </p>
          )}
          {(usageLogsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">
              {["Created", "GeneratingOutline"].includes(job.status)
                ? "Đang chờ lệnh gọi đầu tiên (outline)..."
                : "Chưa có log nào (job viết tay không gọi AI)."}
            </p>
          ) : (
            <div className="space-y-4">
              {(() => {
                const groups = groupUsageLogsByRun(usageLogsQuery.data!);
                return groups
                  .map((group, i) => ({
                    group,
                    runNumber: i + 1,
                    producedVersion: findVersionForRun(
                      group,
                      groups[i + 1]?.[0]?.createdAt,
                      versionsQuery.data ?? [],
                    ),
                    groupCostUsd: group.reduce((sum, log) => sum + log.costUsd, 0),
                  }))
                  .reverse();
              })().map(({ group, runNumber, producedVersion, groupCostUsd }) => {
                return (
                  <div key={group[0]!.id}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Lần chạy {runNumber}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(group[0]!.createdAt).toLocaleString("vi-VN")}
                      </span>
                      <span className="text-zinc-500">${groupCostUsd.toFixed(4)}</span>
                      {producedVersion !== null ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          → đã tạo v{producedVersion}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          → không tạo được bản nháp (lỗi/dừng giữa chừng)
                        </span>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {group.map((log) => (
                        <li key={log.id} className="rounded border border-zinc-200 dark:border-zinc-800">
                          <details>
                            <summary className="cursor-pointer select-none p-2 text-sm">
                              <span className="font-medium">
                                {describeUsageLogOperation(log.operation, log.responseText)}
                              </span>
                              <span className="text-zinc-500">
                                {" "}· {log.provider}/{log.model} · {log.inputTokens + log.outputTokens} tokens ·{" "}
                                ${log.costUsd.toFixed(4)} · {log.latencyMs}ms ·{" "}
                                {new Date(log.createdAt).toLocaleString("vi-VN")}
                              </span>
                            </summary>
                            <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
                              <div>
                                <p className="mb-1 text-xs font-semibold text-zinc-500">Prompt đã gửi</p>
                                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                                  {log.promptText ?? "(không có — job tạo trước khi bật ghi log)"}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-semibold text-zinc-500">Response nhận về</p>
                                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                                  {log.responseText ?? "(không có — job tạo trước khi bật ghi log)"}
                                </pre>
                              </div>
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
