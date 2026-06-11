import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZinoFlow",
  description: "AI Content Tool - local-first admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar — se thay bang shadcn/ui navigation o Day 6 */}
          <aside className="w-56 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800">
            <h1 className="mb-6 text-lg font-bold">ZinoFlow</h1>
            <nav className="space-y-2 text-sm">
              <a href="/" className="block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                Dashboard
              </a>
              <a href="/content" className="block rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                AI Content
              </a>
            </nav>
          </aside>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
