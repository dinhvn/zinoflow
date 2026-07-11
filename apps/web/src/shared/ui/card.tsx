import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./badge";

/** Khung card dung chung cho cac khoi dashboard (tach tu features/dashboard/dashboard-home.tsx
 * de dung lai duoc o dashboard dichoithoi — Phase 23, destination-spec §7.2). */
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </div>
  );
}

export function ActionRow({
  label,
  count,
  href,
  tone,
}: {
  label: string;
  count: number;
  href: string;
  tone: BadgeTone;
}) {
  return (
    <a
      href={href}
      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
        count > 0 ? "border-zinc-200 dark:border-zinc-800" : "border-transparent opacity-60"
      }`}
    >
      <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
      <Badge tone={count > 0 ? tone : "gray"}>{count}</Badge>
    </a>
  );
}
