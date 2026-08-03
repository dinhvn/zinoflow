"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./cn";

export interface ComboboxOption {
  value: string;
  label: string;
}

/** Bo dau + lowercase de search khong dau (go "giay" ra "giày"). */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
}

/**
 * Select co o search (combobox) — plain Tailwind tren native, khong dep ngoai.
 * Dung cho danh sach dai (supplier/category). Search accent-insensitive.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  emptyLabel = "Tất cả",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** Nhan cho lua chon rong (value=""). */
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const fq = fold(q);
    return options.filter((o) => fold(o.label).includes(fq));
  }, [q, options]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded border border-zinc-300 bg-transparent px-3 py-1.5 text-left text-sm",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-zinc-700",
        )}
      >
        <span className={cn("truncate", !selected && "text-zinc-400")}>
          {selected ? selected.label.trim() : emptyLabel}
        </span>
        <span className="shrink-0 text-zinc-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-[1200] mt-1 w-full rounded border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="p-1.5">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Gõ để tìm (không dấu được)..."
              className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-zinc-700"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto pb-1 text-sm">
            <Item active={value === ""} onClick={() => pick("")}>
              <span className="text-zinc-400">{emptyLabel}</span>
            </Item>
            {filtered.map((o) => (
              <Item key={o.value} active={o.value === value} onClick={() => pick(o.value)}>
                {o.label}
              </Item>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-center text-xs text-zinc-400">Không có kết quả</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Item({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "block w-full whitespace-pre px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800",
          active && "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
        )}
      >
        {children}
      </button>
    </li>
  );
}
