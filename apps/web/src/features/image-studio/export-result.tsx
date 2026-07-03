"use client";

import { useQuery } from "@tanstack/react-query";
import { imageJobDetailSchema } from "@zinoflow/contracts";
import { apiGet, apiUrl } from "@/shared/api-client";
import { buttonClasses } from "@/shared/ui/button";

/**
 * Theo doi job render (poll khi dang Rendering) + link tai tung anh / tat ca (spec §9).
 * Tai file qua endpoint /images/jobs/:id/file/:index (the <a download>).
 */
export function ExportResult({ jobId }: { jobId: string }) {
  const query = useQuery({
    queryKey: ["image-job", jobId],
    queryFn: () => apiGet(`/images/jobs/${jobId}`, imageJobDetailSchema),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "Completed" || s === "Failed" ? false : 1500;
    },
  });

  const detail = query.data;
  if (!detail) return <p className="text-xs text-zinc-500">Đang tạo job render…</p>;

  const done = detail.outputs.filter((o) => o.status === "Completed");
  const rendering = detail.status === "Created" || detail.status === "Rendering";

  return (
    <div className="space-y-2 rounded border border-zinc-200 p-2 text-xs dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <span>
          Job {detail.jobId.slice(0, 8)} — {detail.status} ({detail.completedItems}/{detail.totalItems})
        </span>
        {done.length > 0 && (
          <button
            type="button"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
            onClick={() => done.forEach((o) => triggerDownload(jobId, o.index))}
          >
            Tải tất cả ({done.length})
          </button>
        )}
      </div>

      {rendering && <p className="text-zinc-500">Đang render… (lần đầu sẽ tải Chromium, hơi lâu)</p>}

      {detail.outputs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {detail.outputs.map((o) =>
            o.status === "Completed" ? (
              <a
                key={o.index}
                href={apiUrl(`/images/jobs/${jobId}/file/${o.index}`)}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                ⬇ Ảnh {o.index + 1}
              </a>
            ) : (
              <span key={o.index} className="rounded bg-rose-50 px-2 py-1 text-rose-600 dark:bg-rose-950" title={o.error ?? ""}>
                Ảnh {o.index + 1}: lỗi
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Mo link tai file (moi anh 1 lan) — trinh duyet tu tai ve. */
function triggerDownload(jobId: string, index: number) {
  const a = document.createElement("a");
  a.href = apiUrl(`/images/jobs/${jobId}/file/${index}`);
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
