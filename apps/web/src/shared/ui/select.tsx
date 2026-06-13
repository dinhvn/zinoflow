import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Select native dong nhat (giu native: option dark-mode da xu ly o globals.css).
 * Truyen <option> qua children nhu the select thuong.
 */
export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/40",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
