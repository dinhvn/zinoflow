import { ApiError } from "@/shared/api-client";
import { cn } from "./cn";

/**
 * Hop bao loi dong nhat: hien message + danh sach details (vd tu ApiError envelope
 * hoac thong bao "khong ket noi duoc API"). Dung cho moi trang thay vi tu ve inline.
 */
export function ErrorBox({
  error,
  fallback = "Đã xảy ra lỗi",
  className,
}: {
  error: unknown;
  fallback?: string;
  className?: string;
}) {
  const message = error instanceof Error ? error.message : fallback;
  const details = error instanceof ApiError ? error.details : [];
  return (
    <div
      className={cn(
        "rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700",
        "dark:border-red-900 dark:bg-red-950 dark:text-red-300",
        className,
      )}
    >
      <p className="font-medium">{message}</p>
      {details.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-xs">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
