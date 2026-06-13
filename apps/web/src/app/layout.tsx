import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/shared/query-provider";
import { Sidebar } from "@/shared/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZinoFlow",
  description: "AI Content Tool - local-first admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      {/* suppressHydrationWarning: extension trinh duyet (Grammarly, ...) chen
          attribute vao <body> truoc khi React hydrate -> mismatch gia.
          Chi ap dung cho attribute cua chinh <body>, khong an hydration bug that o children. */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <QueryProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
