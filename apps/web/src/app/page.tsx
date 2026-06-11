import { z } from "zod/v4";
import { apiGet } from "@/shared/api-client";

const healthSchema = z.object({
  status: z.string(),
  uptimeSeconds: z.number(),
  database: z.string(),
});

/** Dashboard placeholder — hien trang thai he thong de xac nhan web <-> api hoat dong. */
export default async function DashboardPage() {
  let health: z.infer<typeof healthSchema> | null = null;
  let errorMessage: string | null = null;

  try {
    health = await apiGet("/health", healthSchema);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-semibold">Dashboard</h2>

      <div className="max-w-md rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="mb-2 font-medium">System status</h3>
        {health ? (
          <ul className="space-y-1 text-sm">
            <li>
              API:{" "}
              <span className="font-mono text-green-600 dark:text-green-400">{health.status}</span>
            </li>
            <li>
              Database: <span className="font-mono">{health.database}</span>
            </li>
            <li>
              Uptime: <span className="font-mono">{health.uptimeSeconds}s</span>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-red-600 dark:text-red-400">
            Khong ket noi duoc API: {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
