import type { ReactNode } from "react";
import { cn } from "./cn";

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<TItem> {
  key: string;
  header: ReactNode;
  render: (item: TItem) => ReactNode;
  sortable?: boolean;
  /** Khoa gui len server khi sort (mac dinh = key) */
  sortKey?: string;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<TItem> {
  columns: DataTableColumn<TItem>[];
  items: TItem[];
  rowKey: (item: TItem) => string | number;
  onRowClick?: (item: TItem) => void;
  loading?: boolean;
  loadingMessage?: ReactNode;
  emptyMessage?: ReactNode;
  sortBy?: string;
  sortDir?: SortDirection;
  onSortChange?: (sortKey: string, sortDir: SortDirection) => void;
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/**
 * Bang du lieu dung chung (port CmsDataTable -> Tailwind/dark-mode).
 * Sort do component CHA quan ly (server-side): truyen sortBy/sortDir + onSortChange.
 */
export function DataTable<TItem>({
  columns,
  items,
  rowKey,
  onRowClick,
  loading = false,
  loadingMessage = "Đang tải...",
  emptyMessage = "Không có dữ liệu.",
  sortBy,
  sortDir,
  onSortChange,
}: DataTableProps<TItem>) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
          <tr>
            {columns.map((column) => {
              const key = column.sortKey ?? column.key;
              const isSortable = Boolean(column.sortable && onSortChange);
              const isActive = isSortable && sortBy === key;
              const arrow = isActive ? (sortDir === "asc" ? "▲" : "▼") : "↕";
              return (
                <th
                  key={column.key}
                  aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "px-3 py-2 font-medium",
                    column.align && ALIGN_CLASS[column.align],
                    column.headerClassName,
                  )}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSortChange?.(key, isActive && sortDir === "asc" ? "desc" : "asc")
                      }
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100",
                        isActive ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500",
                      )}
                    >
                      <span>{column.header}</span>
                      <span className="text-xs text-zinc-400">{arrow}</span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-zinc-500">
                {loadingMessage}
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-zinc-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={rowKey(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn(
                  "border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-2",
                      column.align && ALIGN_CLASS[column.align],
                      column.cellClassName,
                    )}
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
