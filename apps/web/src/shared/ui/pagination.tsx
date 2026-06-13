import { useEffect, useState } from "react";
import { cn } from "./cn";
import { Select } from "./select";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * Pagination dung chung:
 * - Trai: chon so dong/trang + tong so muc.
 * - Phai: ve dau (|‹) · truoc (‹) · o nhap so trang / tong · sau (›) · cuoi (›|).
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [pageInput, setPageInput] = useState(String(page));

  // Dong bo o nhap khi page doi tu ben ngoai (vd doi pageSize, filter reset)
  useEffect(() => setPageInput(String(page)), [page]);

  const goTo = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next));
    if (clamped !== page) onPageChange(clamped);
    setPageInput(String(clamped));
  };

  const commitInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(page));
      return;
    }
    goTo(parsed);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      {/* Trai: so dong/trang + tong */}
      <div className="flex items-center gap-2">
        <span>Hiển thị</span>
        <Select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="py-1"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <span>/ trang · tổng {total} mục</span>
      </div>

      {/* Phai: dieu huong trang */}
      <div className="flex items-center gap-1">
        <PagerButton label="Trang đầu" disabled={page <= 1} onClick={() => goTo(1)}>
          ‹‹
        </PagerButton>
        <PagerButton label="Trang trước" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          ‹
        </PagerButton>

        <span className="mx-1 flex items-center gap-1">
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onBlur={commitInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitInput();
            }}
            aria-label="Số trang"
            className="w-12 rounded border border-zinc-300 bg-transparent px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-zinc-700"
          />
          <span>/ {totalPages}</span>
        </span>

        <PagerButton label="Trang sau" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
          ›
        </PagerButton>
        <PagerButton
          label="Trang cuối"
          disabled={page >= totalPages}
          onClick={() => goTo(totalPages)}
        >
          ››
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 items-center justify-center rounded border border-zinc-300 px-2",
        "hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40",
        "dark:border-zinc-700 dark:hover:bg-zinc-800",
      )}
    >
      {children}
    </button>
  );
}
