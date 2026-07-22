"use client";

import { useMutation } from "@tanstack/react-query";
import {
  previewDestinationJobPromptResponseSchema,
  type CreateDestinationJobRequest,
  type PreviewDestinationJobPromptResponse,
} from "@zinoflow/contracts";
import { useEffect } from "react";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { ErrorBox } from "@/shared/ui/error-box";

/**
 * Modal "Xem trước prompt" (tab AI hỗ trợ) — gọi POST :slug/jobs/preview với đúng
 * thông tin đang nhập trên form (KHÔNG tạo job/không gọi AI), để người dùng kiểm
 * tra dữ liệu điểm đến + ghi chú + nguồn tham khảo có đúng trước khi tốn AI thật.
 * Chỉ hiện được prompt bước 1 (outline) — bước 2 (viết nội dung) dùng thêm outline
 * do AI trả về ở bước 1 nên chưa xem trước trọn vẹn được.
 */
export function DestinationPromptPreviewModal({
  slug,
  requestBody,
  onClose,
}: {
  slug: string;
  requestBody: CreateDestinationJobRequest;
  onClose: () => void;
}) {
  const preview = useMutation({
    mutationFn: async () =>
      previewDestinationJobPromptResponseSchema.parse(
        await apiSend("POST", `/destinations/${slug}/jobs/preview`, requestBody),
      ),
  });

  useEffect(() => {
    preview.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-2 text-lg font-semibold">👁️ Xem trước prompt gửi AI</h3>
        <p className="mb-3 text-sm text-zinc-500">
          Đây là prompt <strong>bước 1 (lên khung bài)</strong> — bao gồm system prompt và toàn bộ dữ
          liệu điểm đến/ghi chú/nguồn tham khảo sẽ gửi AI. Bước 2 (viết nội dung từng khối) dùng thêm
          khung bài do AI trả về ở bước 1, nên chưa xem trước trọn vẹn được ở đây — kiểm tra kỹ phần
          &quot;Dữ liệu nguồn&quot; bên dưới là đủ để chắc thông tin đúng.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {preview.isPending && (
            <p className="text-sm text-zinc-500">Đang dựng prompt xem trước...</p>
          )}
          {preview.isError && (
            <ErrorBox
              error={
                preview.error instanceof ApiError
                  ? preview.error
                  : new ApiError(0, String(preview.error), [])
              }
            />
          )}
          {preview.data && <PreviewSections data={preview.data} />}
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

function PreviewSections({ data }: { data: PreviewDestinationJobPromptResponse }) {
  return (
    <div className="space-y-4">
      <PreviewBlock title="Dữ liệu nguồn (sourceContext) — phần dễ sai nhất, kiểm tra kỹ" text={data.sourceContext} defaultOpen />
      <PreviewBlock title="System prompt" text={data.systemPrompt} />
      <PreviewBlock title="Outline prompt (đầy đủ, đã ghép dữ liệu nguồn ở trên)" text={data.outlinePrompt} />
    </div>
  );
}

function PreviewBlock({
  title,
  text,
  defaultOpen,
}: {
  title: string;
  text: string;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer select-none bg-zinc-50 px-3 py-2 text-sm font-medium dark:bg-zinc-900">
        {title}
      </summary>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
        {text}
      </pre>
    </details>
  );
}
