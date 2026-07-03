import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Range slider co label + gia tri hien thi — dung cho zoom/keo anh, do day border...
 * Gia tri hien o ben phai label de chinh truc quan.
 */
export function Slider({
  label,
  value,
  display,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; display?: string }) {
  return (
    <label className="block text-xs">
      <div className="mb-1 flex items-center justify-between text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
        {display != null && <span className="tabular-nums">{display}</span>}
      </div>
      <input
        type="range"
        value={value}
        className={cn("w-full accent-indigo-500", className)}
        {...rest}
      />
    </label>
  );
}
