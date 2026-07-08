"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { createContentJobResponseSchema } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/**
 * Tao bai cam nang moi (dichoithoi-article-spec.md §9) — MVP CHI "Viết tay":
 * nhap tieu de + tu khoa -> tao ngay DraftReady voi khung bai goi y, mo sang
 * editor chung (/content/[id]) de chen khoi dong + viet noi dung that.
 * "Tạo bằng AI" cho loai bai nay chua co prompt pack rieng — de giai doan sau.
 */
export default function NewArticlePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [siteCode, setSiteCode] = useState("dichoithoi");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      createContentJobResponseSchema.parse(
        await apiSend("POST", "/content/jobs/manual", {
          siteCode,
          sourceRef: "cam-nang",
          topic,
          articleType: "cam-nang",
          keywordSeed: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        }),
      ),
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Button
        variant="primary"
        loading={create.isPending}
        disabled={topic.trim().length < 5}
        onClick={() => create.mutate()}
      >
        {create.isPending ? "Đang tạo..." : "✍️ Viết tay — mở editor"}
      </Button>
    </div>
  );
}
