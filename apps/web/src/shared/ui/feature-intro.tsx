import type { ReactNode } from "react";

interface FeatureIntroProps {
  /** Cau tom tat 1-2 dong, LUON hien, khong an sau tooltip/hover */
  summary: ReactNode;
  /** Phan chi tiet dai hon (cach dung, luu y) — thu gon bang <details>, tuy chon */
  details?: ReactNode;
}

/**
 * Giai thich tinh nang ngay tai cho dung (copilot-instructions.md §"Giai thich
 * tinh nang ngay tai cho dung", bat buoc 15/07/2026) — dat dau moi trang/panel
 * tinh nang trong CMS de nguoi dung tu doc hieu khong can hoi lai hay tim doc
 * rieng. Tom tat LUON hien; chi tiet dai (neu co) thu gon qua <details>.
 */
export function FeatureIntro({ summary, details }: FeatureIntroProps) {
  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
      <p>{summary}</p>
      {details && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs font-medium text-indigo-700 dark:text-indigo-300">
            Xem chi tiết
          </summary>
          <div className="mt-1.5 text-xs text-indigo-800 dark:text-indigo-300">{details}</div>
        </details>
      )}
    </div>
  );
}
