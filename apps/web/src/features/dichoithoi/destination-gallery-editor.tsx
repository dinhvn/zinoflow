"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateDestinationGalleryRequestSchema, type GalleryItem } from "@zinoflow/contracts";
import { apiSend, apiUpload, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

interface Props {
  slug: string;
  gallery: GalleryItem[];
  /** Full URL tung anh, cung thu tu voi gallery — server da ghep base (FE khong biet base) */
  imageUrls: (string | null)[];
  /** Goi sau khi luu/upload xong de trang refetch detail */
  onSaved: () => void;
}

const MAX_MB = 15;

/**
 * Quan ly thu vien anh (khac anh dai dien don) — upload nhieu anh, sua alt/
 * caption/nguon, doi thu tu (nut ▲▼, khong dung thu vien keo-tha), xoa anh.
 * Upload ghi ngay (moi anh 1 request rieng); sua/doi thu tu/xoa la state cuc
 * bo, bam "Lưu thư viện ảnh" moi ghi de nguyen mang xuong server.
 */
export function DestinationGalleryEditor({ slug, gallery, imageUrls, onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<GalleryItem[]>(gallery);
  // URL tung anh tra theo path (khong tra theo index) — chi vay moi song sot
  // qua refetch cua parent (props gallery/imageUrls doi rerender, khong remount
  // component nen useState(imageUrls) ban dau se khong tu cap nhat) va qua doi
  // thu tu cuc bo (move/xoa khong lam lech cap path<->URL).
  const [urlByPath, setUrlByPath] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    gallery.forEach((item, i) => {
      const url = imageUrls[i];
      if (url) map[item.path] = url;
    });
    return map;
  });
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [savedJson, setSavedJson] = useState(JSON.stringify(gallery));
  const isDirty = JSON.stringify(items) !== savedJson;

  useEffect(() => {
    setUrlByPath((prev) => {
      const next = { ...prev };
      gallery.forEach((item, i) => {
        const url = imageUrls[i];
        if (url) next[item.path] = url;
      });
      return next;
    });
  }, [gallery, imageUrls]);

  const uploadOne = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiUpload(`/destinations/${slug}/gallery/images`, form, updateDestinationGalleryRequestSchema.shape.gallery);
    },
    onSuccess: (next) => {
      setError(null);
      setItems(next);
      setSavedJson(JSON.stringify(next));
      // Anh moi vua them chua co URL (server chua tra) — se tu co sau khi
      // onSaved() lam parent refetch, effect ben tren dien lai urlByPath.
      onSaved();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Upload ảnh thất bại"),
  });

  /**
   * Canh bao mem truoc khi luu (SEO ảnh gallery #1, 20/07/2026) — KHONG chan
   * cung, chi hoi lai khi con anh thieu alt hoac alt trung nhau (dung khi
   * nguoi dung tu xoa alt tu goi y roi upload nhieu anh cung 1 chu thich).
   */
  function hasWeakAltText(list: GalleryItem[]): boolean {
    const normalized = list.map((it) => (it.altText ?? "").trim().toLowerCase());
    if (normalized.some((a) => a.length === 0)) return true;
    const seen = new Set<string>();
    for (const a of normalized) {
      if (seen.has(a)) return true;
      seen.add(a);
    }
    return false;
  }

  function handleSaveClick() {
    if (hasWeakAltText(items) && !window.confirm(
      "Có ảnh đang thiếu mô tả (alt text) hoặc mô tả giống hệt ảnh khác — " +
        "điều này làm giảm hiệu quả SEO ảnh. Vẫn muốn lưu?",
    )) {
      return;
    }
    save.mutate();
  }

  const save = useMutation({
    mutationFn: () => apiSend("POST", `/destinations/${slug}/gallery`, { gallery: items }),
    onSuccess: () => {
      setError(null);
      setSavedJson(JSON.stringify(items));
      onSaved();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Lưu thất bại"),
  });

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.items)
      .filter((it) => it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length === 0) return;
    e.preventDefault();
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    handleFiles(dt.files);
  }

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
      uploadOne.mutate(file);
    }
  }

  function update(index: number, patch: Partial<GalleryItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Thư viện ảnh <span className="font-normal text-zinc-400">({items.length})</span>
      </h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Nhiều ảnh cho 1 điểm đến — website hiển thị thành dải ảnh vuốt được ở hero và ngay dưới
        hero. Ảnh đại diện (thumbnail) ở mục trên là ảnh riêng, không nằm trong thư viện này.
      </p>

      {items.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {items.map((item, i) => (
            <div key={item.path} className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
              {urlByPath[item.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlByPath[item.path]}
                  alt={item.altText ?? ""}
                  className="mb-2 h-48 w-full rounded bg-zinc-100 object-contain dark:bg-zinc-900"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div className="mb-2 flex h-48 w-full items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-900">
                  Chưa có preview
                </div>
              )}
              <Input
                value={item.altText ?? ""}
                onChange={(e) => update(i, { altText: e.target.value || null })}
                placeholder="Alt text"
                className="mb-1 w-full text-xs"
              />
              <Input
                value={item.caption ?? ""}
                onChange={(e) => update(i, { caption: e.target.value || null })}
                placeholder="Chú thích"
                className="mb-1 w-full text-xs"
              />
              <Input
                value={item.credit ?? ""}
                onChange={(e) => update(i, { credit: e.target.value || null })}
                placeholder="Nguồn ảnh"
                className="mb-1 w-full text-xs"
              />
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5 py-0.5 text-xs"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ▲
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5 py-0.5 text-xs"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ▼
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400"
                  onClick={() => remove(i)}
                >
                  Xoá
                </Button>
              </div>
            </div>
          ))}
        </div>
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
          handleFiles(e.dataTransfer.files);
        }}
        onPaste={handlePaste}
        tabIndex={0}
        className={`mt-3 flex flex-wrap items-center gap-2 rounded-lg border-2 border-dashed p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
          dragOver
            ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
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
          variant="secondary"
          loading={uploadOne.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {uploadOne.isPending ? "Đang upload..." : "+ Thêm ảnh"}
        </Button>
        <Button size="sm" variant="primary" loading={save.isPending} disabled={!isDirty} onClick={handleSaveClick}>
          {save.isPending ? "Đang lưu..." : "Lưu thư viện ảnh"}
        </Button>
        {!isDirty && !save.isPending && items.length > 0 && (
          <span className="text-xs text-zinc-400">Đã lưu</span>
        )}
        <span className="text-xs text-zinc-400">
          Kéo/dán (Ctrl+V) ảnh vào khung này, hoặc bấm "+ Thêm ảnh" · tối đa {MAX_MB}MB/ảnh · nhiều ảnh cùng lúc
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
