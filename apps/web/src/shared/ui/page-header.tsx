import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/**
 * Header chuẩn cho mọi trang trong khu dichoithoi — title + mô tả bên trái,
 * nút hành động bên phải. Dùng chung để mọi trang có cùng 1 kiểu bố cục
 * (không tự ý bọc max-w/p-6 riêng — khung ngoài `<main>` đã lo padding).
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
