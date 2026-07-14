"use client";

import { useRef, useState } from "react";
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
  const [urls, setUrls] = useState<(string | null)[]>(imageUrls);
  const [error, setError] = useState<string | null>(null);
  const [savedJson, setSavedJson] = useState(JSON.stringify(gallery));
  const isDirty = JSON.stringify(items) !== savedJson;

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
      // Chi biet path moi vua them, chua co URL day du (server chua tra) — de trong,
      // preview se hien dung sau khi trang refetch detail (onSaved).
      setUrls((prev) => [...prev, ...Array(Math.max(0, next.length - prev.length)).fill(null)]);
      onSaved();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Upload ảnh thất bại"),
  });

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
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setUrls((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target] ?? null, next[index] ?? null];
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, i) => (
            <div key={item.path} className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
              {urls[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urls[i]!}
                  alt={item.altText ?? ""}
                  className="mb-2 h-24 w-full rounded object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : (
                <div className="mb-2 flex h-24 w-full items-center justify-center rounded bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-900">
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
        <Button size="sm" variant="primary" loading={save.isPending} disabled={!isDirty} onClick={() => save.mutate()}>
          {save.isPending ? "Đang lưu..." : "Lưu thư viện ảnh"}
        </Button>
        {!isDirty && !save.isPending && items.length > 0 && (
          <span className="text-xs text-zinc-400">Đã lưu</span>
        )}
        <span className="text-xs text-zinc-400">Tối đa {MAX_MB}MB/ảnh · chọn nhiều ảnh cùng lúc</span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
