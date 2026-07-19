"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  autoSearchContentImagesResponseSchema,
  listContentImagesResponseSchema,
  scanArticlesMissingImagesResponseSchema,
  type ArticleMissingImage,
  type AutoSearchArticleResult,
  type ContentImage,
} from "@zinoflow/contracts";
import { apiGet, apiSend, apiUpload, ApiError } from "@/shared/api-client";
import { Badge, Button, ErrorBox, FeatureIntro, Input, Modal, PageHeader, Textarea } from "@/shared/ui";

const QUERY_KEY = ["content-images"];
const MAX_MB = 15;
type Tab = "active" | "pending";

/**
 * Thư viện ảnh nội dung (dichoithoi-content-image-library-plan.md §3.3 +
 * dichoithoi-auto-image-search-plan.md) — kho ảnh MINH HOẠ CHUNG dùng để chèn
 * vào bài viết cẩm nang qua token `[[block:image id=...]]`, KHÁC HOÀN TOÀN
 * ảnh hero/thumbnail/gallery của điểm đến (2 kho tách biệt). Cách dùng:
 * upload ảnh (hoặc bấm "Tự động tìm ảnh còn thiếu" để hệ thống tự tìm qua
 * Pexels cho các bài chưa có ảnh) → sửa alt text → bấm "Copy token" → dán vào
 * markdown đang soạn (khối phải nằm riêng 1 dòng, có H2/H3 ngay phía trên).
 * Ảnh tự động tìm luôn ở tab "Chờ duyệt" — phải Duyệt mới dùng được, tránh
 * ảnh sai/không liên quan lọt ra bài viết mà không ai kiểm tra.
 */
export default function ThuVienAnhPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [autoSearchOpen, setAutoSearchOpen] = useState(false);
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiGet("/content-images", listContentImagesResponseSchema),
  });

  const pendingCount = query.data?.images.filter((i) => i.status === "pending").length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Thư viện ảnh nội dung"
        description="Kho ảnh minh hoạ chung để chèn vào bài viết cẩm nang — không phải ảnh đại diện điểm đến."
        actions={
          <Button size="sm" variant="secondary" onClick={() => setAutoSearchOpen(true)}>
            Tự động tìm ảnh còn thiếu
          </Button>
        }
      />
      <FeatureIntro
        summary="Upload ảnh minh hoạ chung (món ăn, cảnh sinh hoạt...) rồi copy token dán vào bài viết đang soạn để chèn ảnh."
        details={
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Upload ảnh (kéo-thả, dán Ctrl+V, hoặc bấm nút) → điền Alt text (bắt buộc, dùng cho SEO
              + người khiếm thị).
            </li>
            <li>
              Bấm <span className="font-medium">Copy token</span> trên ảnh muốn dùng, dán dòng đó vào
              đúng chỗ trong markdown đang soạn — khối phải nằm riêng 1 dòng, có tiêu đề H2/H3 ngay
              phía trên (giống các khối động khác).
            </li>
            <li>Ảnh đang được bài viết nào tham chiếu sẽ không xoá được — gỡ token khỏi bài trước.</li>
            <li>
              <span className="font-medium">Tự động tìm ảnh còn thiếu</span>: quét các bài cẩm nang
              chưa có ảnh nào, tự tìm ảnh minh hoạ chung qua Pexels (ảnh có giấy phép thương mại,
              không phải Google Images) — ảnh tìm được luôn nằm ở tab "Chờ duyệt", phải xem và Duyệt
              tay mới dùng được trong bài, KHÔNG tự publish.
            </li>
            <li>Kho này tách biệt hoàn toàn khỏi ảnh đại diện/gallery của điểm đến.</li>
          </ul>
        }
      />

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Thư viện
        </TabButton>
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          Chờ duyệt {pendingCount > 0 && <Badge tone="amber">{pendingCount}</Badge>}
        </TabButton>
      </div>

      {query.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải thư viện ảnh" />}
      {query.data && (
        <ImageLibrary images={query.data.images.filter((i) => i.status === tab)} tab={tab} />
      )}

      {autoSearchOpen && <AutoSearchModal onClose={() => setAutoSearchOpen(false)} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? "border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300"
          : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function ImageLibrary({ images, tab }: { images: ContentImage[]; tab: Tab }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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

  function copyToken(id: string) {
    navigator.clipboard.writeText(`[[block:image id=${id}]]`);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
  }

  return (
    <div className="space-y-3">
      {tab === "active" && (
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
          className={`flex flex-wrap items-center gap-2 rounded-lg border-2 border-dashed p-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
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
            variant="primary"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? "Đang upload..." : "+ Thêm ảnh"}
          </Button>
          <span className="text-xs text-zinc-400">
            Kéo/dán (Ctrl+V) ảnh vào khung này, hoặc bấm nút · tối đa {MAX_MB}MB/ảnh · chọn nhiều ảnh
            cùng lúc
          </span>
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {images.length === 0 && (
        <p className="text-sm text-zinc-500">
          {tab === "active" ? "Chưa có ảnh nào trong thư viện." : "Không có ảnh nào đang chờ duyệt."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {images.map((image) =>
          tab === "pending" ? (
            <PendingImageCard key={image.id} image={image} />
          ) : (
            <ImageCard key={image.id} image={image} copied={copiedId === image.id} onCopyToken={copyToken} />
          ),
        )}
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

/** Anh o tab "Cho duyet" — chi Duyet/Tu choi, khong cho sua alt/copy token
 * (chua phai anh dung duoc, tranh nham voi anh da duyet — plan §2.2 muc 4) */
function PendingImageCard({ image }: { image: ContentImage }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const approve = useMutation({
    mutationFn: () => apiSend("POST", `/content-images/${image.id}/approve`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Duyệt thất bại"),
  });

  const reject = useMutation({
    mutationFn: () => apiSend("POST", `/content-images/${image.id}/reject`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Từ chối thất bại"),
  });

  return (
    <div className="rounded border border-amber-200 bg-amber-50/40 p-2 dark:border-amber-900 dark:bg-amber-950/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.imageUrl} alt={image.altText} className="mb-2 h-24 w-full rounded object-cover" />
      {image.relatedArticle && (
        <p className="mb-1 line-clamp-1 text-[11px] text-zinc-500">
          Cho bài: <span className="font-medium">{image.relatedArticle.title}</span>
        </p>
      )}
      {image.searchKeyword && (
        <p className="mb-1 line-clamp-1 text-[11px] text-zinc-400">Từ khoá: {image.searchKeyword}</p>
      )}
      {image.photographer && (
        <p className="mb-1 line-clamp-1 text-[11px] text-zinc-400">
          Nguồn: {image.source} — {image.photographer}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="primary" loading={approve.isPending} onClick={() => approve.mutate()}>
          Duyệt
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 dark:text-red-400"
          loading={reject.isPending}
          onClick={() => reject.mutate()}
        >
          Từ chối
        </Button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Man "Tu dong tim anh con thieu" (plan §2.4) — buoc 1 quet, buoc 2 chon bai
 * + chay tim, buoc 3 xem tom tat ket qua. Tach 2 buoc de tranh goi API Pexels
 * lang phi neu buoc quet chon sai (plan §3 Giai doan 3). */
function AutoSearchModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<AutoSearchArticleResult[] | null>(null);
  const queryClient = useQueryClient();

  const scan = useQuery({
    queryKey: ["content-images", "missing-articles"],
    queryFn: () => apiGet("/content-images/missing-articles", scanArticlesMissingImagesResponseSchema),
  });

  const run = useMutation({
    mutationFn: async () => {
      const raw = await apiSend("POST", "/content-images/auto-search", { jobIds: [...selected] });
      return autoSearchContentImagesResponseSchema.parse(raw);
    },
    onSuccess: (data) => {
      setResults(data.results);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  function toggle(jobId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  return (
    <Modal open onClose={onClose} title="Tự động tìm ảnh còn thiếu">
      <div className="space-y-3">
        <p className="text-xs text-zinc-500">
          Quét các bài cẩm nang đã có nội dung nhưng chưa chèn ảnh nào, tìm ảnh minh hoạ chung qua
          Pexels, đưa vào tab "Chờ duyệt" — chưa dùng được trong bài ngay, phải duyệt tay từng ảnh.
        </p>

        {scan.isLoading && <p className="text-sm text-zinc-500">Đang quét...</p>}
        {scan.isError && <ErrorBox error={scan.error} fallback="Lỗi quét bài viết" />}
        {scan.data && scan.data.articles.length === 0 && (
          <p className="text-sm text-zinc-500">Không có bài nào đang thiếu ảnh.</p>
        )}
        {scan.data && scan.data.articles.length > 0 && !results && (
          <>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {scan.data.articles.map((article: ArticleMissingImage) => (
                <label key={article.jobId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(article.jobId)}
                    onChange={() => toggle(article.jobId)}
                  />
                  <span className="line-clamp-1">{article.title}</span>
                </label>
              ))}
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={selected.size === 0}
              loading={run.isPending}
              onClick={() => run.mutate()}
            >
              Chạy tìm ảnh ({selected.size} bài)
            </Button>
          </>
        )}
        {run.isError && <ErrorBox error={run.error} fallback="Lỗi chạy tìm ảnh" />}

        {results && (
          <div className="space-y-1.5">
            {results.map((r) => (
              <div key={r.jobId} className="rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                <div className="font-medium">{r.title}</div>
                <div className="text-zinc-500">Từ khoá: {r.keyword}</div>
                <div className={r.stagedCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>
                  {r.stagedCount > 0 ? `Tìm được ${r.stagedCount} ảnh — xem ở tab "Chờ duyệt"` : r.note}
                </div>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={onClose}>
              Đóng
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
