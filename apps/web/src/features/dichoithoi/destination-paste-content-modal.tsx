"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { destinationArticleSchema, type DestinationArticle } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { ErrorBox } from "@/shared/ui/error-box";

/**
 * Modal "Dán bài có sẵn" (pivot gop editor vao trang detail) — nhan text dan tu AI
 * khac (ChatGPT/Gemini) hoac tu viet chua dung cau truc, goi AI (Haiku) tach lai
 * vao dung 6 khoi co dinh, tra thang ve cho trang detail merge vao draftArticle
 * cuc bo (nguoi dung con phai bam Luu moi ghi that) — KHONG con tao ContentJob.
 */
export function DestinationPasteContentModal({
  name,
  onClose,
  onApplied,
}: {
  name: string;
  onClose: () => void;
  onApplied: (article: DestinationArticle) => void;
}) {
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const restructure = useMutation({
    mutationFn: async () =>
      destinationArticleSchema.parse(
        await apiSend("POST", "/destinations/restructure-paste", {
          rawText: rawText.trim(),
          topic: name,
          keywordSeed: [],
        }),
      ),
    onSuccess: (article) => {
      onApplied(article);
      onClose();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError ? { message: e.message, details: e.details } : { message: String(e), details: [] },
      ),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-2 text-lg font-semibold">Dán bài viết có sẵn</h3>
        <p className="mb-3 text-sm text-zinc-500">
          Dán nguyên bài viết đã có (từ ChatGPT/Gemini khác, hoặc bản nháp tự viết) — AI sẽ chỉ{" "}
          <strong>tách lại</strong> vào đúng 7 khối chuẩn (Tổng quan, Trải nghiệm, Mùa nào, Lịch trình,
          Di chuyển, Ăn gì, Mẹo & lưu ý, Quà mang về), KHÔNG viết mới/bịa thêm. Kết quả sẽ điền thẳng
          vào ô soạn bên dưới —
          bạn rà soát/sửa rồi bấm <strong>Lưu bản nháp</strong> như bình thường.
        </p>
        <p className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          ⚠️ Nếu đang có nội dung đã lưu, kết quả tách sẽ <strong>ghi đè toàn bộ</strong> ô soạn hiện
          tại (chưa lưu xuống server cho tới khi bạn bấm Lưu).
        </p>
        <Textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={12}
          placeholder="Dán bài viết vào đây..."
          className="w-full"
        />
        {error && <ErrorBox error={new ApiError(0, error.message, error.details)} className="mt-3" />}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" disabled={restructure.isPending} onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            loading={restructure.isPending}
            disabled={rawText.trim().length < 50}
            onClick={() => restructure.mutate()}
          >
            {restructure.isPending ? "Đang tách nội dung..." : "Tách nội dung bằng AI"}
          </Button>
        </div>
      </div>
    </div>
  );
}
