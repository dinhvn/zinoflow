"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listContentImagesResponseSchema,
  type ContentImage,
} from "@zinoflow/contracts";
import { apiGet, apiSend, apiUpload, ApiError } from "@/shared/api-client";
import { Button, ErrorBox, FeatureIntro, Input, PageHeader, Textarea } from "@/shared/ui";

const QUERY_KEY = ["content-images"];
const MAX_MB = 15;

/**
 * Thư viện ảnh nội dung (dichoithoi-content-image-library-plan.md §3.3) — kho ảnh
 * MINH HOẠ CHUNG dùng để chèn vào bài viết cẩm nang qua token
 * `[[block:image id=...]]`, KHÁC HOÀN TOÀN ảnh hero/thumbnail/gallery của điểm
 * đến (2 kho tách biệt). Cách dùng: upload ảnh → sửa alt text (bắt buộc, dùng
 * cho SEO + accessibility) → bấm "Copy token" trên ảnh cần dùng → dán dòng đó
 * vào đúng chỗ trong markdown đang soạn (khối phải nằm RIÊNG 1 dòng, có tiêu đề
 * H2/H3 ngay phía trên). Ảnh đang được bài viết nào tham chiếu sẽ không xoá
 * được (tránh vỡ ảnh trong bài đã/đang soạn).
 */
export default function ThuVienAnhPage() {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet("/content-images", listContentImagesResponseSchema),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thư viện ảnh nội dung"
        description="Kho ảnh minh hoạ chung để chèn vào bài viết cẩm nang — không phải ảnh đại diện điểm đến."
      />
      <FeatureIntro
        summary="Upload ảnh minh hoạ chung (món ăn, cảnh sinh hoạt...) rồi copy token dán vào bài viết đang soạn để chèn ảnh."
        details={
          <ul className="list-disc space-y-1 pl-4">
            <li>Upload ảnh → điền Alt text (bắt buộc, dùng cho SEO + người khiếm thị).</li>
            <li>
              Bấm <span className="font-medium">Copy token</span> trên ảnh muốn dùng, dán dòng đó vào
              đúng chỗ trong markdown đang soạn — khối phải nằm riêng 1 dòng, có tiêu đề H2/H3 ngay
              phía trên (giống các khối động khác).
            </li>
            <li>Ảnh đang được bài viết nào tham chiếu sẽ không xoá được — gỡ token khỏi bài trước.</li>
            <li>Kho này tách biệt hoàn toàn khỏi ảnh đại diện/gallery của điểm đến.</li>
          </ul>
        }
      />

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải thư viện ảnh" />}
      {query.data && <ImageLibrary images={query.data.images} />}
    </div>
  );
}

function ImageLibrary({ images }: { images: ContentImage[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("altText", file.name.replace(/\.[a-zA-Z0-9]+$/, ""));
      return apiUpload("/content-images", form, listContentImagesResponseSchema.shape.images.element);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Upload ảnh thất bại"),
  });

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setError(`"${file.name}" không phải ảnh`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`"${file.name}" vượt quá ${MAX_MB}MB`);
        continue;
      }
      upload.mutate(file);
    }
  }

  function copyToken(id: string) {
    navigator.clipboard.writeText(`[[block:image id=${id}]]`);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="primary"
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? "Đang upload..." : "+ Thêm ảnh"}
        </Button>
        <span className="text-xs text-zinc-400">Tối đa {MAX_MB}MB/ảnh · chọn nhiều ảnh cùng lúc</span>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {images.length === 0 && <p className="text-sm text-zinc-500">Chưa có ảnh nào trong thư viện.</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {images.map((image) => (
          <ImageCard key={image.id} image={image} copied={copiedId === image.id} onCopyToken={copyToken} />
        ))}
      </div>
    </div>
  );
}

function ImageCard({
  image,
  copied,
  onCopyToken,
}: {
  image: ContentImage;
  copied: boolean;
  onCopyToken: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [altText, setAltText] = useState(image.altText);
  const [caption, setCaption] = useState(image.caption ?? "");
  const [error, setError] = useState<string | null>(null);
  const isDirty = altText !== image.altText || caption !== (image.caption ?? "");

  const save = useMutation({
    mutationFn: () =>
      apiSend("PATCH", `/content-images/${image.id}`, {
        altText,
        caption: caption.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Lưu thất bại"),
  });

  const remove = useMutation({
    mutationFn: () => apiSend("DELETE", `/content-images/${image.id}`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Xoá thất bại"),
  });

  return (
    <div className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.imageUrl} alt={image.altText} className="mb-2 h-24 w-full rounded object-cover" />
      <Input
        value={altText}
        onChange={(e) => setAltText(e.target.value)}
        placeholder="Alt text"
        className="mb-1 w-full text-xs"
      />
      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Chú thích (tuỳ chọn)"
        rows={2}
        className="mb-1 w-full text-xs"
      />
      {image.usageCount > 0 && (
        <p className="mb-1 text-[11px] text-zinc-400">Đang dùng trong {image.usageCount} bài</p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="secondary" loading={save.isPending} disabled={!isDirty} onClick={() => save.mutate()}>
          Lưu
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onCopyToken(image.id)}>
          {copied ? "Đã copy!" : "Copy token"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 dark:text-red-400"
          loading={remove.isPending}
          onClick={() => {
            if (confirm(`Xoá ảnh "${image.altText}"?`)) remove.mutate();
          }}
        >
          Xoá
        </Button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
