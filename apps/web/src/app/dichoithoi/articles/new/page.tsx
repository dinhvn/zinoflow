"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createContentJobResponseSchema,
  listAiProvidersResponseSchema,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { FeatureIntro } from "@/shared/ui";

/**
 * Tao bai cam nang moi (dichoithoi-article-spec.md §9, §1.1, §1.2) — 2 lua
 * chon: "Viết tay" (di thang DraftReady voi khung goi y) hoac "Tạo bằng AI"
 * (Phase 22, 07/2026 — prompt pack cam-nang.*.vi da co, xem default-prompts.ts).
 * AI tu goi y chen khoi dong [[block:...]] khi hop ngu canh — nguoi dung van
 * duyet/sua qua man review truoc khi publish, khong co duong tat.
 */
export default function NewArticlePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [siteCode, setSiteCode] = useState("dichoithoi");
  const [sourceContext, setSourceContext] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
  });
  const usableProviders = (providersQuery.data?.providers ?? []).filter(
    (p) => p.isConfigured && p.isEnabled && p.models.length > 0,
  );
  const selectedProvider =
    usableProviders.find((p) => p.key === provider) ?? usableProviders[0] ?? null;
  const selectedModel =
    selectedProvider?.models.find((m) => m.id === model) ?? selectedProvider?.models[0] ?? null;

  const keywordSeed = keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const createManual = useMutation({
    mutationFn: async () =>
      createContentJobResponseSchema.parse(
        await apiSend("POST", "/content/jobs/manual", {
          siteCode,
          sourceRef: "cam-nang",
          topic,
          articleType: "cam-nang",
          keywordSeed,
        }),
      ),
    onSuccess: (result) => router.push(`/content/${result.jobId}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const createByAi = useMutation({
    mutationFn: async () => {
      if (!selectedProvider || !selectedModel) {
        throw new Error("Chưa có AI provider khả dụng — kiểm tra Settings và API key");
      }
      return createContentJobResponseSchema.parse(
        await apiSend("POST", "/content/jobs", {
          siteCode,
          sourceType: "Topic",
          sourceRef: "cam-nang",
          topic,
          articleType: "cam-nang",
          keywordSeed,
          sourceContext: sourceContext.trim() || undefined,
          aiProvider: selectedProvider.key,
          aiModel: selectedModel.id,
        }),
      );
    },
    onSuccess: (result) => router.push(`/content/${result.jobId}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold">Bài cẩm nang mới</h2>
      <p className="text-sm text-zinc-500">
        Bài tổng hợp nhiều điểm/khách sạn/tour theo chủ đề (vd &quot;Các con thác đẹp tại Việt
        Nam&quot;) — có thể chèn khối động, tự động thay bằng dữ liệu thật lúc đăng bài.
      </p>

      <FeatureIntro
        summary={
          <>
            2 cách tạo: <strong>Viết tay</strong> mở thẳng editor với khung gợi ý (không tốn AI),{" "}
            <strong>Tạo bằng AI</strong> để AI soạn nháp trước (tốn 1 lượt gọi AI, vẫn phải duyệt
            trước khi đăng).
          </>
        }
        details={
          <>
            Dù chọn cách nào, bài luôn dừng ở bước duyệt trên trang <code>/content/&#123;id&#125;</code>{" "}
            — không có đường tắt đăng thẳng. AI có thể tự gợi ý chèn khối động dạng{" "}
            <code>[[block:...]]</code> (tự thay bằng dữ liệu thật lúc publish) khi thấy hợp ngữ
            cảnh — nhưng vẫn cần người duyệt kiểm tra lại ở bước sau. &quot;Tư liệu tham khảo&quot;
            không bắt buộc nhưng giúp AI bám sát thực tế hơn thay vì bịa chi tiết.
          </>
        }
      />

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500">Tiêu đề / chủ đề bài viết</span>
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="VD: Các con thác đẹp tại Việt Nam"
          minLength={5}
          className="w-full"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500">Từ khóa SEO (phân cách bằng dấu phẩy)</span>
        <Input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="VD: thác đẹp, thác nước Việt Nam"
          className="w-full"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500">Site code</span>
        <Input value={siteCode} onChange={(e) => setSiteCode(e.target.value)} className="w-full" />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500">
          Tư liệu tham khảo (tuỳ chọn — dán ghi chú/link nguồn để AI viết bám sát thực tế hơn)
        </span>
        <Textarea
          value={sourceContext}
          onChange={(e) => setSourceContext(e.target.value)}
          placeholder="VD: liệt kê tên các thác/khách sạn muốn nhắc tới, kèm ghi chú thật đã biết..."
          rows={4}
          className="w-full"
        />
      </label>

      <details className="mb-2 rounded border border-zinc-200 text-xs dark:border-zinc-800">
        <summary className="cursor-pointer select-none bg-zinc-50 px-2 py-1 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          💡 Chọn model Gemini nào cho phù hợp?
        </summary>
        <div className="space-y-1 px-2 py-2 text-zinc-500 dark:text-zinc-400">
          <p>
            <strong>Gemini 3.6 Flash / 3.5 Flash</strong> — mô hình chính khi tạo hàng loạt bài
            điểm đến: nhanh, rẻ, xuất dữ liệu có cấu trúc (JSON/Markdown) chuẩn để đưa thẳng vào
            database.
          </p>
          <p>
            <strong>Gemini 3.1 Pro</strong> — chỉ dùng cho bài "Key/Featured" cần văn phong mượt,
            sâu (vd tổng quan Đà Lạt, TP.HCM, Hạ Long); chi phí cao hơn Flash.
          </p>
          <p>
            <strong>Nhiệt độ (temperature)</strong> khác nhau theo thao tác, không chỉnh tay được:
            <strong> trích xuất thông tin</strong> dùng 0.1 (ưu tiên chính xác/nhất quán) —
            <strong> viết bài</strong> dùng 0.5 (câu từ mềm mại, giàu cảm xúc hơn nhưng vẫn bám sát
            dữ liệu nguồn).
          </p>
        </div>
      </details>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">AI Provider</span>
          <Select
            value={selectedProvider?.key ?? ""}
            onChange={(e) => {
              setProvider(e.target.value);
              setModel("");
            }}
            className="w-full"
          >
            {usableProviders.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Model</span>
          <Select
            value={selectedModel?.id ?? ""}
            onChange={(e) => setModel(e.target.value)}
            className="w-full"
          >
            {selectedProvider?.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          loading={createManual.isPending}
          disabled={topic.trim().length < 5}
          onClick={() => createManual.mutate()}
        >
          {createManual.isPending ? "Đang tạo..." : "✍️ Viết tay — mở editor"}
        </Button>
        <Button
          variant="primary"
          loading={createByAi.isPending}
          disabled={topic.trim().length < 5 || !selectedProvider || !selectedModel}
          onClick={() => createByAi.mutate()}
        >
          {createByAi.isPending ? "Đang tạo..." : "🤖 Tạo bằng AI"}
        </Button>
      </div>
    </div>
  );
}
