/**
 * API client mong cho apps/api. Moi response duoc validate bang Zod schema
 * tu @zinoflow/contracts truoc khi tra ve component — loi schema phat hien som
 * thay vi render sai. Dung chung cho server component va client component.
 */
import type { z } from "zod/v4";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Token khop voi API_TOKEN phia api (auth gate). Local dev co the de trong. */
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;

function authHeaders(): Record<string, string> {
  return API_TOKEN ? { "x-api-token": API_TOKEN } : {};
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Error envelope tu API (neu parse duoc) — chua details + traceId. */
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  try {
    const body = (await res.json()) as { message?: string; details?: string[] };
    return new ApiError(res.status, body.message ?? fallback, body.details ?? []);
  } catch {
    return new ApiError(res.status, fallback);
  }
}

export async function apiGet<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw await toApiError(res, `GET ${path} failed: ${res.status}`);
  return schema.parse(await res.json());
}

/** POST/PATCH voi JSON body. Tra ve response da parse (unknown neu khong can schema). */
export async function apiSend(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res, `${method} ${path} failed: ${res.status}`);
  return res.json();
}
