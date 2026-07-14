"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Modal giua man hinh (centered dialog) — dung cho cac form/luong ngan gon
 * (vd nhap Google Sheet) thay vi dieu huong sang trang rieng. Dong khi bam
 * nen hoac Esc. Luon mount de co animation fade/scale vao/ra.
 */
export function Modal({
  open,
  onClose,
  title,
  width = "max-w-2xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  width?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", !open && "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col rounded-lg bg-white shadow-xl transition-all duration-200 dark:bg-zinc-900",
          width,
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0",
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
