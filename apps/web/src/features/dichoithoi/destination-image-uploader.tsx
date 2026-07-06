"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { uploadDestinationImageResponseSchema } from "@zinoflow/contracts";
import { apiUpload } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";

interface Props {
  slug: string;
  /** URL anh hien tai (thumb) de xem truoc; null neu chua co */
  imageUrl: string | null;
  /** Goi khi upload xong de trang refetch (imageUrl doi) */
  onUploaded: () => void;
}

const MAX_MB = 15;

/**
 * Keo-tha / chon 1 anh goc -> POST /destinations/:slug/images.
 * API tu convert 3 co WebP + FTP len hosting + ghi cot Thumbnail (spec §14.3).
 * Component chi lo chon file + hien trang thai; khong biet FTP/sharp.
 */
export function DestinationImageUploader({ slug, imageUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiUpload(`/destinations/${slug}/images`, form, uploadDestinationImageResponseSchema);
    },
    onSuccess: () => {
      setError(null);
      onUploaded();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Upload ảnh thất bại"),
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File không phải ảnh");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Ảnh vượt quá ${MAX_MB}MB`);
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    upload.mutate(file);
  }

  const shownImage = preview ?? imageUrl;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ảnh đại diện</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Kéo thả hoặc chọn 1 ảnh gốc — hệ thống tự chuyển WebP, tạo 3 cỡ theo chiều rộng rồi đẩy FTP
        lên hosting và điền đường dẫn thumbnail. Ảnh gốc chỉ bị thu nhỏ, không phóng to.
      </p>
      {/* Cac co phai khop WIDTHS trong sharp-image-processor.ts (BE la nguon su that) */}
      <ul className="mt-2 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        <li>
          <b className="text-zinc-700 dark:text-zinc-300">hero.webp</b> — rộng 1600px · ảnh đầu bài
          &amp; og:image
        </li>
        <li>
          <b className="text-zinc-700 dark:text-zinc-300">medium.webp</b> — rộng 800px · dùng cho
          srcset
        </li>
        <li>
          <b className="text-zinc-700 dark:text-zinc-300">thumb.webp</b> — rộng 400px · card danh
          sách / liên quan / tìm kiếm (lưu vào cột Thumbnail)
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        {shownImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownImage}
            alt="Ảnh đại diện"
            className="h-24 w-32 rounded object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          <p className="text-zinc-500 dark:text-zinc-400">
            Kéo ảnh vào đây, hoặc
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            size="sm"
            variant="secondary"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? "Đang xử lý & upload..." : "Chọn ảnh"}
          </Button>
          <span className="text-xs text-zinc-400">Tối đa {MAX_MB}MB · JPG/PNG/WebP</span>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {upload.isSuccess && !error && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          Đã upload &amp; cập nhật ảnh đại diện.
        </p>
      )}
    </div>
  );
}
