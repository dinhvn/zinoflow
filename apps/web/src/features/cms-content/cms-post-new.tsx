"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createCmsPostResponseSchema,
  KHUYENMAI_POST_TYPES,
  type KhuyenmaiSite,
} from "@zinoflow/contracts";
import { apiSend } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { ErrorBox } from "@/shared/ui/error-box";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

/** Tao bai moi cho 1 site CMS — INSERT shell roi nhay sang trang chi tiet de viet bai AI. */
export function CmsPostNew({ site }: { site: KhuyenmaiSite }) {
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState("");

  const create = useMutation({
    mutationFn: async () =>
      createCmsPostResponseSchema.parse(
        await apiSend("POST", `/cms/${site}/posts`, {
          title: title.trim(),
          postType: postType ? Number(postType) : undefined,
        }),
      ),
    onSuccess: (r) => {
      window.location.href = `/${site}/${r.cmsId}`;
    },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <a href={`/${site}`} className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>
      <div>
        <h2 className="text-xl font-semibold">Thêm bài mới — {site}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tạo khung bài (chưa có post WordPress). Sau khi soạn nội dung bằng AI và ghi vào CMS,
          bạn vào CMS bấm Publish — lần đầu CMS sẽ tự tạo post WordPress.
        </p>
      </div>

      {create.isError && <ErrorBox error={create.error} fallback="Tạo bài thất bại" />}

      <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Tiêu đề bài</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Top 5 đồ chơi lắp ghép cho bé 6 tuổi"
            className="w-full"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Loại bài (PostType)</span>
          <Select value={postType} onChange={(e) => setPostType(e.target.value)} className="w-full">
            <option value="">— Chọn loại (có thể đổi sau trong CMS) —</option>
            {KHUYENMAI_POST_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="primary"
          loading={create.isPending}
          disabled={title.trim().length < 5}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Đang tạo..." : "Tạo bài"}
        </Button>
      </div>
    </div>
  );
}
