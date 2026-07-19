"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "./api-client";

/** TanStack Query client cho toan app — polling job status, cache providers list. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Loi MANG (status 0 — "Khong ket noi duoc API", vd luc `pnpm dev` chay
            // API+web song song, Next.js san sang truoc NestJS ~10-15s do phai compile
            // ca backend) can thu lai NHIEU + KIEN TRI hon loi API that (4xx/5xx) —
            // truoc day retry:1 chung cho ca 2 loai, het rat nhanh (~1s) roi bao loi
            // vinh vien cho toi khi nguoi dung tu F5, dung luc API con dang khoi dong.
            retry: (failureCount, error) =>
              error instanceof ApiError && error.status === 0 ? failureCount < 8 : failureCount < 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
            staleTime: 10_000,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
