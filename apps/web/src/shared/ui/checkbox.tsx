import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

/** Checkbox co label — dung cho toggle an/hien thong tin, filter san pham. */
export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className={cn("h-4 w-4 accent-indigo-500", className)}
        {...rest}
      />
      <span className="text-zinc-700 dark:text-zinc-200">{label}</span>
    </label>
  );
}
