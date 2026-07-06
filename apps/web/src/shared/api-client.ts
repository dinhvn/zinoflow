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

/**
 * Goi fetch + bien loi mang (server tat / sai port / CORS) thanh ApiError ro rang.
 * Truoc day loi nay nem TypeError "Failed to fetch" tru tru -> kho chan doan.
 */
async function fetchOrThrow(url: string, init: RequestInit, label: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new ApiError(
      0,
      `Không kết nối được API tại ${API_BASE_URL} (${label}). Kiểm tra server API đã chạy chưa (cổng 3001) hoặc NEXT_PUBLIC_API_URL.`,
      [detail],
    );
  }
}

/** URL tuyet doi toi 1 endpoint API — dung cho link tai file (the <a href>), khong qua fetch. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}/api${path}`;
}

export async function apiGet<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const url = `${API_BASE_URL}/api${path}`;
  const res = await fetchOrThrow(url, { cache: "no-store", headers: authHeaders() }, `GET ${path}`);
  if (!res.ok) throw await toApiError(res, `GET ${path} failed: ${res.status}`);
  return schema.parse(await res.json());
}

/**
 * Upload multipart (FormData) — KHONG set Content-Type de trinh duyet tu them
 * boundary. Dung cho upload anh (POST /destinations/:slug/images).
 */
export async function apiUpload<TSchema extends z.ZodType>(
  path: string,
  formData: FormData,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const url = `${API_BASE_URL}/api${path}`;
  const res = await fetchOrThrow(
    url,
    { method: "POST", headers: authHeaders(), body: formData },
    `POST ${path}`,
  );
  if (!res.ok) throw await toApiError(res, `POST ${path} failed: ${res.status}`);
  return schema.parse(await res.json());
}

/** POST/PATCH/PUT voi JSON body. Tra ve response da parse (unknown neu khong can schema). */
export async function apiSend(
  method: "POST" | "PATCH" | "PUT",
  path: string,
  body: unknown,
): Promise<unknown> {
  const url = `${API_BASE_URL}/api${path}`;
  const res = await fetchOrThrow(
    url,
    {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    },
    `${method} ${path}`,
  );
  if (!res.ok) throw await toApiError(res, `${method} ${path} failed: ${res.status}`);
  return res.json();
}
