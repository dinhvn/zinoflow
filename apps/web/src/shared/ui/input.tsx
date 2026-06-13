import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

/** Input text dong nhat (style chung cho moi trang). */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "rounded border border-zinc-300 bg-transparent px-3 py-1.5 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500/40",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700",
        className,
      )}
      {...rest}
    />
  );
}
