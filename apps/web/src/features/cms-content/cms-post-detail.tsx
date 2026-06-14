"use client";

import { useQuery } from "@tanstack/react-query";
import {
  cmsPostDetailSchema,
  khuyenmaiPostTypeLabel,
  type KhuyenmaiSite,
} from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { ErrorBox } from "@/shared/ui/error-box";

/** Chi tiet 1 bai CMS — dung chung /laruki/[id], /dochoi3s/[id]. Phase 1: thong tin + tag. */
export function CmsPostDetail({ site, cmsId }: { site: KhuyenmaiSite; cmsId: number }) {
  const detailQuery = useQuery({
    queryKey: ["cms-post", cmsId],
    queryFn: () => apiGet(`/cms/posts/${cmsId}`, cmsPostDetailSchema),
  });
  const d = detailQuery.data;

  return (
    <div className="max-w-4xl space-y-5">
      <a href={`/${site}`} className="text-sm text-zinc-500 hover:underline">
        ← Quay lại danh sách
      </a>

      {detailQuery.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {detailQuery.isError && <ErrorBox error={detailQuery.error} fallback="Lỗi tải bài viết" />}

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

          {/* Tag hien co trong content CMS (chi doc) */}
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
            <p className="mt-2 text-xs text-zinc-400">
              Tag do CMS thay bằng dữ liệu thật khi publish (danh sách sản phẩm, link affiliate...).
              AI sẽ gợi ý + giữ nguyên tag khi viết lại.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
            ✍️ Khu "Viết bài bằng AI" sẽ thêm ở bước sau (nhập mô tả + URL nguồn → AI tạo/cập nhật
            nội dung → ghi vào CMS).
          </div>
        </>
      )}
    </div>
  );
}
