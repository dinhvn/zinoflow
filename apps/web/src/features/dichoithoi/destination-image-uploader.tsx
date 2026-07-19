"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  checkImageResponseSchema,
  updateHeroImageMetaRequestSchema,
  updateThumbnailRequestSchema,
  uploadDestinationImageResponseSchema,
  type HeroImageMeta,
} from "@zinoflow/contracts";
import { apiSend, apiUpload, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface Props {
  slug: string;
  /** URL anh hien tai (thumb) de xem truoc; null neu chua co */
  imageUrl: string | null;
  /** Duong dan tuong doi hien tai cua thumbnail (cot Thumbnail); null neu chua co */
  thumbnailPath: string | null;
  /** Mo ta rieng (alt/caption/credit) cho Anh dai dien; null neu chua nhap */
  heroImageMeta: HeroImageMeta | null;
  /** Goi khi upload xong de trang refetch (imageUrl doi) */
  onUploaded: () => void;
}

const MAX_MB = 15;

/**
 * Keo-tha / chon 1 anh goc -> POST /destinations/:slug/images.
 * API tu convert 3 co WebP + FTP len hosting + ghi cot Thumbnail (spec §14.3).
 * Component chi lo chon file + hien trang thai; khong biet FTP/sharp.
 */
export function DestinationImageUploader({
  slug,
  imageUrl,
  thumbnailPath,
  heroImageMeta,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState(thumbnailPath ?? "");
  const [imageCheck, setImageCheck] = useState<{ exists: boolean } | null>(null);
  const [manualSaved, setManualSaved] = useState(false);
  const [altText, setAltText] = useState(heroImageMeta?.altText ?? "");
  const [caption, setCaption] = useState(heroImageMeta?.caption ?? "");
  const [credit, setCredit] = useState(heroImageMeta?.credit ?? "");
  const normalizeMeta = (m: HeroImageMeta): HeroImageMeta | null =>
    m.altText || m.caption || m.credit ? m : null;
  const [savedMetaJson, setSavedMetaJson] = useState(
    JSON.stringify(normalizeMeta(heroImageMeta ?? { altText: null, caption: null, credit: null })),
  );
  const currentMeta: HeroImageMeta = {
    altText: altText.trim() || null,
    caption: caption.trim() || null,
    credit: credit.trim() || null,
  };
  const isMetaDirty = JSON.stringify(normalizeMeta(currentMeta)) !== savedMetaJson;

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

  const saveHeroImageMeta = useMutation({
    mutationFn: () => {
      const body = updateHeroImageMetaRequestSchema.parse({
        heroImageMeta: normalizeMeta(currentMeta),
      });
      return apiSend("POST", `/destinations/${slug}/hero-image-meta`, body);
    },
    onSuccess: () => {
      setError(null);
      setSavedMetaJson(JSON.stringify(normalizeMeta(currentMeta)));
      onUploaded();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Lưu mô tả thất bại"),
  });

  const checkImage = useMutation({
    mutationFn: async () =>
      checkImageResponseSchema.parse(
        await apiSend("POST", "/destinations/check-image", { path: manualPath.trim() }),
      ),
    onSuccess: (r) => setImageCheck({ exists: r.exists }),
  });

  const saveManualPath = useMutation({
    mutationFn: () => {
      const body = updateThumbnailRequestSchema.parse({ thumbnail: manualPath.trim() || null });
      return apiSend("POST", `/destinations/${slug}/thumbnail`, body);
    },
    onSuccess: () => {
      setError(null);
      setManualSaved(true);
      onUploaded();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Lưu đường dẫn thất bại"),
  });

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    handleFile(item.getAsFile() ?? undefined);
  }

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
          <b className="text-zinc-700 dark:text-zinc-300">{"{slug}"}-hero.webp</b> — rộng 1600px ·
          ảnh đầu bài &amp; og:image
        </li>
        <li>
          <b className="text-zinc-700 dark:text-zinc-300">{"{slug}"}-medium.webp</b> — rộng 800px ·
          dùng cho srcset
        </li>
        <li>
          <b className="text-zinc-700 dark:text-zinc-300">{"{slug}"}-thumb.webp</b> — rộng 400px ·
          card danh sách / liên quan / tìm kiếm (lưu vào cột Thumbnail)
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
          onPaste={handlePaste}
          tabIndex={0}
          className={`flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
            dragOver
              ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          <p className="text-zinc-500 dark:text-zinc-400">
            Kéo ảnh vào đây, dán (Ctrl+V) sau khi bấm vào khung, hoặc
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

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Hoặc trỏ tới ảnh có sẵn trên hosting (đường dẫn tương đối)
        </p>
        <div className="mt-1.5 flex gap-2">
          <Input
            value={manualPath}
            onChange={(e) => {
              setManualPath(e.target.value);
              setImageCheck(null);
              setManualSaved(false);
            }}
            placeholder="vd: slug.webp hoặc diem-den/slug/slug-thumb.webp"
            className="flex-1 text-sm"
          />
          <Button
            size="sm"
            loading={checkImage.isPending}
            disabled={!manualPath.trim()}
            onClick={() => manualPath.trim() && checkImage.mutate()}
          >
            Kiểm tra
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={saveManualPath.isPending}
            disabled={manualPath.trim() === (thumbnailPath ?? "")}
            onClick={() => saveManualPath.mutate()}
          >
            Lưu
          </Button>
        </div>
        {imageCheck && (
          <p
            className={`mt-1 text-xs ${imageCheck.exists ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
          >
            {imageCheck.exists ? "✅ Ảnh tồn tại" : "⚠️ Chưa tìm thấy ảnh"}
          </p>
        )}
        {manualSaved && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Đã lưu đường dẫn.</p>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Mô tả riêng cho ảnh đại diện (giống Thư viện ảnh)
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Website đè chú thích này lên ảnh hero to nhất ở đầu trang. Bỏ trống thì hero không hiện
          chú thích (alt vẫn fallback về tên điểm đến).
        </p>
        <div className="mt-1.5 space-y-1.5">
          <Input
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Alt text (mô tả ảnh cho SEO/trình đọc màn hình)"
            className="w-full text-sm"
          />
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Chú thích đè lên ảnh hero"
            className="w-full text-sm"
          />
          <Input
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            placeholder="Nguồn ảnh"
            className="w-full text-sm"
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            loading={saveHeroImageMeta.isPending}
            disabled={!isMetaDirty}
            onClick={() => saveHeroImageMeta.mutate()}
          >
            Lưu mô tả ảnh đại diện
          </Button>
          {!isMetaDirty && !saveHeroImageMeta.isPending && (
            <span className="text-xs text-zinc-400">Đã lưu</span>
          )}
        </div>
      </div>
    </div>
  );
}
