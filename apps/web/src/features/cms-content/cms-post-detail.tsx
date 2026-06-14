"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  cmsPostDetailSchema,
  createCmsJobResponseSchema,
  khuyenmaiPostTypeLabel,
  listAiProvidersResponseSchema,
  type KhuyenmaiSite,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ErrorBox } from "@/shared/ui/error-box";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

/** Chi tiet 1 bai CMS — dung chung /laruki/[id], /dochoi3s/[id]. */
export function CmsPostDetail({ site, cmsId }: { site: KhuyenmaiSite; cmsId: number }) {
  const [actionError, setActionError] = useState<{ message: string; details: string[] } | null>(null);
  const [userNotes, setUserNotes] = useState("");
  const [tagHints, setTagHints] = useState("");
  const [refUrls, setRefUrls] = useState<Array<{ label: string; url: string }>>([{ label: "Nguồn", url: "" }]);
  const [inputsSaved, setInputsSaved] = useState(false);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");

  const detailQuery = useQuery({
    queryKey: ["cms-post", cmsId],
    queryFn: () => apiGet(`/cms/posts/${cmsId}`, cmsPostDetailSchema),
  });
  const d = detailQuery.data;

  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
  });
  const usableProviders = (providersQuery.data?.providers ?? []).filter(
    (p) => p.isConfigured && p.isEnabled && p.models.length > 0,
  );
  const selectedProvider = usableProviders.find((p) => p.key === provider) ?? usableProviders[0] ?? null;
  const selectedModel =
    selectedProvider?.models.find((m) => m.id === model) ?? selectedProvider?.models[0] ?? null;

  // Prefill thong tin AI da luu khi mo bai
  useEffect(() => {
    if (!d) return;
    setUserNotes(d.aiNotes ?? "");
    setTagHints(d.aiTagHints ?? "");
    setRefUrls(d.aiReferenceUrls.length > 0 ? d.aiReferenceUrls : [{ label: "Nguồn", url: "" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.cmsId]);

  const aiInputsBody = () => ({
    userNotes: userNotes.trim() || undefined,
    tagHints: tagHints.trim() || undefined,
    referenceUrls: refUrls.filter((r) => r.url.trim() && r.label.trim()),
  });

  function toActionError(e: unknown) {
    return e instanceof ApiError
      ? { message: e.message, details: e.details }
      : { message: String(e), details: [] };
  }

  const saveInputs = useMutation({
    mutationFn: () => apiSend("POST", `/cms/posts/${cmsId}/ai-inputs`, aiInputsBody()),
    onSuccess: () => {
      setActionError(null);
      setInputsSaved(true);
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  const createJob = useMutation({
    mutationFn: async () =>
      createCmsJobResponseSchema.parse(
        await apiSend("POST", `/cms/posts/${cmsId}/jobs`, {
          mode: d?.contentState === "chua-co-bai" ? "create" : "update",
          ...aiInputsBody(),
          aiProvider: selectedProvider?.key,
          aiModel: selectedModel?.id,
        }),
      ),
    onSuccess: (r) => {
      window.location.href = `/content/${r.jobId}`;
    },
    onError: (e) => setActionError(toActionError(e)),
  });

  return (
    <div className="max-w-4xl space-y-5">
      <a href={`/${site}`} className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>

      {detailQuery.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {detailQuery.isError && <ErrorBox error={detailQuery.error} fallback="Lỗi tải bài viết" />}
      {actionError && (
        <ErrorBox error={new ApiError(0, actionError.message, actionError.details)} />
      )}

      {d && (
        <>
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-xl font-semibold">{d.title}</h2>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
              <span>Loại: {khuyenmaiPostTypeLabel(d.postType)}</span>
              <span>{d.postId === 0 ? "Bài mới (chưa có WP post)" : `WP post #${d.postId}`}</span>
              {d.link && (
                <a href={d.link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                  Mở trên web ↗
                </a>
              )}
            </div>
          </div>

          {/* Tag hien co (chi doc) */}
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-2 font-medium">Tag hiện có trong bài</h3>
            {d.existingTags.length === 0 ? (
              <p className="text-sm text-zinc-500">Chưa có tag nào.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {d.existingTags.map((t) => (
                  <Badge key={t} tone="indigo" className="font-mono">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Viet bai bang AI */}
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="mb-3 font-medium">✍️ Viết bài bằng AI</h3>
            {d.activeContentJobId ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Đang có 1 bài cho điểm này.{" "}
                <a href={`/content/${d.activeContentJobId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                  Mở bài để xem / duyệt →
                </a>
                <br />
                <span className="text-xs text-zinc-500">Hoàn tất (hoặc từ chối) bài hiện tại trước khi viết lại.</span>
              </p>
            ) : (
              <div className="space-y-4">
                <p className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
                  AI viết toàn bộ nội dung + <strong>gợi ý chèn tag</strong> theo gợi ý của bạn, và{" "}
                  <strong>giữ nguyên tag cũ</strong> khi viết lại. Số liệu/giá sản phẩm do CMS thay tag lúc publish.
                </p>

                <Field label="Thông tin bổ sung cho AI">
                  <textarea
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    rows={3}
                    placeholder="Bối cảnh, điểm nhấn, đối tượng đọc, lưu ý niche..."
                    className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                  />
                </Field>

                <Field label="Gợi ý tag (supplier/product code, loại block muốn có)">
                  <textarea
                    value={tagHints}
                    onChange={(e) => setTagHints(e.target.value)}
                    rows={2}
                    placeholder="VD: chèn danh sách sản phẩm supplier juno; product tag innisfree-jeju; thêm [Year] vào tiêu đề..."
                    className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                  />
                </Field>

                <Field label="Website nguồn để AI đọc thêm (có thể là trang tiếng Anh)">
                  <div className="space-y-2">
                    {refUrls.map((row, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={row.label}
                          onChange={(e) => setRefUrls((rs) => rs.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                          placeholder="Nhãn"
                          className="w-32"
                        />
                        <Input
                          value={row.url}
                          onChange={(e) => setRefUrls((rs) => rs.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))}
                          placeholder="https://..."
                          className="flex-1"
                        />
                        {refUrls.length > 1 && (
                          <Button onClick={() => setRefUrls((rs) => rs.filter((_, j) => j !== i))}>✕</Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {refUrls.length < 5 && (
                    <button
                      onClick={() => setRefUrls((rs) => [...rs, { label: "", url: "" }])}
                      className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      + Thêm nguồn
                    </button>
                  )}
                </Field>

                <Field label="AI Provider / Model">
                  {usableProviders.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Chưa có AI provider khả dụng — kiểm tra API key + bật provider trong Settings.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={selectedProvider?.key ?? ""}
                        onChange={(e) => {
                          setProvider(e.target.value);
                          setModel("");
                        }}
                      >
                        {usableProviders.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.displayName}
                          </option>
                        ))}
                      </Select>
                      <Select value={selectedModel?.id ?? ""} onChange={(e) => setModel(e.target.value)}>
                        {(selectedProvider?.models ?? []).map((m) => (
                          <option key={m.id} value={m.id} title={m.costNote}>
                            {m.displayName}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </Field>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    loading={createJob.isPending}
                    disabled={!selectedProvider || !selectedModel}
                    onClick={() => createJob.mutate()}
                  >
                    {createJob.isPending
                      ? "Đang tạo bài..."
                      : d.contentState === "chua-co-bai"
                        ? "Tạo bài AI"
                        : "Viết lại / cập nhật bài"}
                  </Button>
                  <Button loading={saveInputs.isPending} onClick={() => saveInputs.mutate()}>
                    {saveInputs.isPending ? "Đang lưu..." : "Lưu thông tin (chưa tạo bài)"}
                  </Button>
                  {inputsSaved && !saveInputs.isPending && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">✅ Đã lưu</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
