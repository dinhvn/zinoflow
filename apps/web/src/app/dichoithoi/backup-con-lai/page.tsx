"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClusterPoiBackupRemainingResponseSchema,
  getDestinationsMapResponseSchema,
  type ClusterPoiBackupRemainingItem,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Badge, Button, Combobox, ErrorBox, FeatureIntro, type ComboboxOption } from "@/shared/ui";

/**
 * Man "Backup còn lại" (dot lam moi du lieu theo Atlas — GD7
 * plan-lam-moi-du-lieu-atlas.md) — DIEU KIEN CUNG chong mat du lieu am tham: liet
 * ke moi dong trong bang tam dichoithoi_destinations_backup CHUA duoc khoi phuc
 * vao dau (khong khop duoc voi bat ky ket qua AI nao khi chay "Tìm điểm con trong
 * cụm"). Dot lam moi CHI COI LA XONG khi trang nay ve 0 dong.
 */
export default function ClusterPoiBackupRemainingPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);

  const remainingQuery = useQuery({
    queryKey: ["cluster-poi-backup-remaining"],
    queryFn: () => apiGet("/destinations/cluster-poi-backup/remaining", getClusterPoiBackupRemainingResponseSchema),
  });

  const clustersQuery = useQuery({
    queryKey: ["destinations-map-clusters"],
    queryFn: () => apiGet("/destinations/map", getDestinationsMapResponseSchema),
  });
  const clusterOptions: ComboboxOption[] = (clustersQuery.data?.items ?? [])
    .filter((d) => d.kind === "cluster")
    .sort((a, b) => (a.provinceName ?? "").localeCompare(b.provinceName ?? "") || a.name.localeCompare(b.name))
    .map((d) => ({ value: d.slug, label: `${d.name} (${d.provinceName ?? "?"})` }));

  const restore = useMutation({
    mutationFn: ({ slug, targetClusterSlug }: { slug: string; targetClusterSlug: string }) =>
      apiSend("POST", `/destinations/cluster-poi-backup/${slug}/restore`, { targetClusterSlug }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["cluster-poi-backup-remaining"] });
    },
    onError: (e) => setError(e),
  });

  const skip = useMutation({
    mutationFn: ({ slug, note }: { slug: string; note: string }) =>
      apiSend("POST", `/destinations/cluster-poi-backup/${slug}/skip`, { note }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["cluster-poi-backup-remaining"] });
    },
    onError: (e) => setError(e),
  });

  const items = remainingQuery.data?.items ?? [];

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">📦 Backup còn lại</h2>
      </div>

      <FeatureIntro
        summary={
          <>
            Danh sách điểm cũ trong bảng backup <strong>chưa được khôi phục vào cụm nào</strong> — đợt làm mới
            dữ liệu theo Atlas chỉ coi là <strong>xong</strong> khi trang này về 0 dòng.
          </>
        }
        details={
          <>
            Mỗi dòng là 1 điểm đến từng tồn tại trước khi làm mới dữ liệu, chưa khớp được với kết quả nào của
            tính năng &quot;Tìm điểm con trong cụm bằng AI&quot;. Với mỗi dòng: chọn 1 cụm rồi bấm &quot;Khôi
            phục&quot; để đưa nguyên bài viết/ảnh/toạ độ cũ vào cụm đó, hoặc bấm &quot;Bỏ hẳn&quot; kèm lý do
            nếu điểm này không còn giá trị (ví dụ trùng lặp thật với điểm khác).
          </>
        }
      />

      {error !== null && <ErrorBox error={error instanceof ApiError ? error : new ApiError(0, String(error), [])} />}
      {remainingQuery.isError && <ErrorBox error={remainingQuery.error} />}

      {remainingQuery.isLoading ? (
        <p className="text-sm text-zinc-500">Đang tải...</p>
      ) : items.length === 0 ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
          ✅ Không còn dòng backup nào chưa xử lý.
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            Còn <strong>{items.length}</strong> điểm chưa xử lý.
          </p>
          <div className="space-y-3">
            {items.map((item) => (
              <BackupRow
                key={item.slug}
                item={item}
                clusterOptions={clusterOptions}
                onRestore={(targetClusterSlug) => restore.mutate({ slug: item.slug, targetClusterSlug })}
                onSkip={(note) => skip.mutate({ slug: item.slug, note })}
                restoring={restore.isPending}
                skipping={skip.isPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BackupRow({
  item,
  clusterOptions,
  onRestore,
  onSkip,
  restoring,
  skipping,
}: {
  item: ClusterPoiBackupRemainingItem;
  clusterOptions: ComboboxOption[];
  onRestore: (targetClusterSlug: string) => void;
  onSkip: (note: string) => void;
  restoring: boolean;
  skipping: boolean;
}) {
  const [targetCluster, setTargetCluster] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [showSkip, setShowSkip] = useState(false);

  return (
    <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-zinc-500">{item.shortDescription ?? "—"}</p>
          <div className="mt-1 flex gap-1">
            <Badge tone={item.hasArticle ? "emerald" : "gray"}>{item.hasArticle ? "✍️ có bài viết" : "chưa có bài"}</Badge>
            <Badge tone={item.hasImages ? "emerald" : "gray"}>{item.hasImages ? "🖼️ có ảnh" : "chưa có ảnh"}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Combobox
          value={targetCluster}
          onChange={setTargetCluster}
          options={clusterOptions}
          placeholder="Chọn cụm để khôi phục vào..."
          className="min-w-[280px]"
        />
        <Button
          size="sm"
          variant="primary"
          disabled={!targetCluster}
          loading={restoring}
          onClick={() => onRestore(targetCluster)}
        >
          Khôi phục
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowSkip((v) => !v)}>
          Bỏ hẳn
        </Button>
      </div>

      {showSkip && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Lý do bỏ hẳn (bắt buộc)..."
            value={skipNote}
            onChange={(e) => setSkipNote(e.target.value)}
            className="min-w-[280px] rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!skipNote.trim()}
            loading={skipping}
            onClick={() => onSkip(skipNote.trim())}
          >
            Xác nhận bỏ hẳn
          </Button>
        </div>
      )}
    </div>
  );
}
