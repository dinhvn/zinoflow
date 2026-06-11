/**
 * API client mong cho apps/api. Moi response duoc validate bang Zod schema
 * tu @zinoflow/contracts truoc khi tra ve component — loi schema phat hien som
 * thay vi render sai. Dung chung cho server component va client component.
 */
import type { z } from "zod/v4";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new ApiError(res.status, `GET ${path} failed: ${res.status}`);
  }
  return schema.parse(await res.json());
}
