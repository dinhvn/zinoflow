"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  articleDestinationMapResponseSchema,
  articleTopicSchema,
  type ArticleAddedLink,
  type ArticleTopic,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";

const TOPIC_LABELS: Record<ArticleTopic, string> = {
  itinerary: "Lịch trình",
  food: "Ăn uống",
  souvenir: "Quà mang về",
  nightlife: "Buổi tối",
  "poi-guide": "Điểm tham quan",
  general: "Chung",
};

interface Row {
  destinationSlug: string;
  destinationName: string;
  topic: ArticleTopic;
  checked: boolean;
}

/**
 * Gán bài cẩm nang -> điểm đến theo topic (article-spec §8.1, Phase 26 — nền
 * tảng). Gợi ý từ danh sách điểm đến auto-link được lúc publish
 * (`addedLinks`) — người dùng tick xác nhận/sửa topic/xoá trước khi lưu,
 * KHÔNG bao giờ tự gán im lặng. Trang điểm đến sẽ dùng bảng này ở Phase 28.
 */
export function ArticleDestinationMapPanel({
  jobId,
  suggestions,
}: {
  jobId: string;
  suggestions: ArticleAddedLink[];
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const mapQuery = useQuery({
    queryKey: ["article-destination-map", jobId],
    queryFn: () =>
      apiGet(`/articles/${jobId}/destination-map`, articleDestinationMapResponseSchema),
  });

  useEffect(() => {
    if (!mapQuery.data) return;
    const existingBySlug = new Map(mapQuery.data.items.map((i) => [i.destinationSlug, i]));
    const fromExisting: Row[] = mapQuery.data.items.map((i) => ({
      destinationSlug: i.destinationSlug,
      destinationName: i.destinationName,
      topic: i.topic,
      checked: true,
    }));
    const fromSuggestions: Row[] = suggestions
      .filter((s) => !existingBySlug.has(s.targetSlug))
      .map((s) => ({
        destinationSlug: s.targetSlug,
        destinationName: s.targetName,
        topic: "general",
        checked: false,
      }));
    setRows([...fromExisting, ...fromSuggestions]);
  }, [mapQuery.data, suggestions]);

  const save = useMutation({
    mutationFn: async () => {
      if (!rows) return;
      const items = rows
        .filter((r) => r.checked)
        .map((r, i) => ({ destinationSlug: r.destinationSlug, topic: r.topic, order: i }));
      await apiSend("PUT", `/articles/${jobId}/destination-map`, { items });
    },
    onSuccess: () => setSavedAt(Date.now()),
  });

  if (!rows || rows.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="mb-2 font-medium">Gán điểm đến cho bài (article-spec §8.1)</h3>
      <p className="mb-3 text-sm text-zinc-500">
        Tick xác nhận các điểm đến bài này thực sự viết về, chọn đúng khối (topic) sẽ hiện
        link trên trang điểm đến.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.destinationSlug} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={row.checked}
              onChange={(e) =>
                setRows((prev) =>
                  prev!.map((r, j) => (j === i ? { ...r, checked: e.target.checked } : r)),
                )
              }
            />
            <span className="flex-1">{row.destinationName}</span>
            <Select
              value={row.topic}
              disabled={!row.checked}
              onChange={(e) =>
                setRows((prev) =>
                  prev!.map((r, j) =>
                    j === i ? { ...r, topic: e.target.value as ArticleTopic } : r,
                  ),
                )
              }
              className="w-40"
            >
              {articleTopicSchema.options.map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          Lưu gán điểm đến
        </Button>
        {savedAt && <span className="text-sm text-emerald-600 dark:text-emerald-400">Đã lưu</span>}
      </div>
    </div>
  );
}
