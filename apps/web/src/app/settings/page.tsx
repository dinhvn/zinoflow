"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAiProvidersResponseSchema, type AiProviderKey } from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => apiGet("/content/ai-providers", listAiProvidersResponseSchema),
  });

  const toggleProvider = useMutation({
    mutationFn: ({ key, isEnabled }: { key: AiProviderKey; isEnabled: boolean }) =>
      apiSend("PATCH", `/content/ai-providers/${key}`, { isEnabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["ai-providers"] }),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="font-medium">AI Providers</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Tắt provider để ẩn khỏi dropdown tạo bài và chặn tạo job mới.
            API key cấu hình trong <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">apps/api/.env</code> (cần restart API sau khi đổi).
          </p>
        </div>

        {providersQuery.isLoading && <p className="p-4 text-sm text-zinc-500">Đang tải...</p>}

        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {(providersQuery.data?.providers ?? []).map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{p.displayName}</p>
                <div className="mt-1 flex gap-2 text-xs">
                  {p.isConfigured ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-300">
                      Có API key
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-zinc-800">
                      Chưa có API key
                    </span>
                  )}
                  {p.models.length > 0 ? (
                    <span className="text-zinc-400">{p.models.length} models</span>
                  ) : (
                    <span className="text-zinc-400">Adapter chưa implement</span>
                  )}
                </div>
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={p.isEnabled}
                disabled={toggleProvider.isPending}
                onClick={() => toggleProvider.mutate({ key: p.key, isEnabled: !p.isEnabled })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  p.isEnabled ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    p.isEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
