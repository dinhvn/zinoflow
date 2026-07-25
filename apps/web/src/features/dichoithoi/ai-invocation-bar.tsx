"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listAiProvidersResponseSchema, type PromptPreviewSection } from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { ErrorBox } from "@/shared/ui/error-box";
import { Select } from "@/shared/ui/select";

/**
 * Thanh dieu khien DUNG CHUNG cho moi noi trong khu dichoithoi co goi AI ma
 * khong co man tao job rieng (Kanban Type/Tag, goi y Tag hang loat...): chon
 * Provider/Model + nut "Xem prompt" xem truoc noi dung se gui AI (khong ton AI
 * that). Phan hoi nguoi dung 24/07/2026: "chỗ nào cũng có thể chọn ai provider,
 * và xem trước được prompt" + "viết thành 1 component dùng chung".
 *
 * Man da co UI job rieng (vd tao bai Article/Destination o `[slug]/page.tsx`)
 * giu nguyen provider/model Select + `DestinationPromptPreviewModal` cua rieng
 * no — KHONG doi sang component nay (khac hinh dang: preview theo nhieu buoc,
 * gan voi form nhap lieu phuc tap hon), chi ap dung cho cac nut "Goi y AI" don
 * gian moi chua co ca 2 tinh nang nay.
 */
export function AiInvocationBar({
  onSelectionChange,
  fetchPreview,
  previewDisabled,
  previewDisabledReason,
}: {
  onSelectionChange: (provider: string, model: string) => void;
  fetchPreview: () => Promise<PromptPreviewSection[]>;
  previewDisabled?: boolean;
  previewDisabledReason?: string;
}) {
  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
  });
  const usableProviders = (providersQuery.data?.providers ?? []).filter(
    (p) => p.isConfigured && p.isEnabled && p.models.length > 0,
  );
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const selectedProvider = usableProviders.find((p) => p.key === provider) ?? usableProviders[0] ?? null;
  const selectedModel =
    selectedProvider?.models.find((m) => m.id === model) ?? selectedProvider?.models[0] ?? null;

  useEffect(() => {
    if (selectedProvider && selectedModel) onSelectionChange(selectedProvider.key, selectedModel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider?.key, selectedModel?.id]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const preview = useMutation({ mutationFn: fetchPreview });

  function openPreview() {
    setPreviewOpen(true);
    preview.mutate();
  }

  if (providersQuery.isLoading) {
    return <p className="text-xs text-zinc-400">Đang tải AI provider...</p>;
  }
  if (usableProviders.length === 0) {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Chưa có AI provider khả dụng — kiểm tra API key và bật provider trong trang Settings.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={selectedProvider?.key ?? ""}
        onChange={(e) => {
          setProvider(e.target.value);
          setModel(""); // reset model khi doi provider
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
      <Button
        size="sm"
        variant="secondary"
        type="button"
        disabled={previewDisabled}
        title={previewDisabled ? previewDisabledReason : undefined}
        onClick={openPreview}
      >
        👁️ Xem prompt
      </Button>
      {previewOpen && (
        <AiPromptPreviewModal
          loading={preview.isPending}
          error={preview.isError ? preview.error : null}
          sections={preview.data ?? null}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function AiPromptPreviewModal({
  loading,
  error,
  sections,
  onClose,
}: {
  loading: boolean;
  error: unknown;
  sections: PromptPreviewSection[] | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-2 text-lg font-semibold">👁️ Xem trước prompt gửi AI</h3>
        <p className="mb-3 text-sm text-zinc-500">
          Không gọi AI thật — chỉ dựng sẵn đúng nội dung sẽ gửi (theo provider/model và phạm vi đang
          chọn) để bạn kiểm tra trước.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && <p className="text-sm text-zinc-500">Đang dựng prompt xem trước...</p>}
          {error !== null && <ErrorBox error={error} fallback="Lỗi dựng prompt xem trước" />}
          {sections &&
            sections.map((s, i) => (
              <details
                key={i}
                open={i === 0}
                className="mb-2 rounded border border-zinc-200 dark:border-zinc-800"
              >
                <summary className="cursor-pointer select-none bg-zinc-50 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
                  {s.title}
                </summary>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                  {s.text}
                </pre>
              </details>
            ))}
        </div>

        <div className="mt-3 flex justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
