import { CanActivate, ExecutionContext, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../errors/app-error";

/** 401 voi error envelope chuan (khong dung UnauthorizedException de giu format). */
class UnauthorizedError extends AppError {
  constructor() {
    super("ValidationError", "Thiếu hoặc sai API token", ["Gửi header: x-api-token: <API_TOKEN>"], 401);
  }
}

/** Cac path cong khai — health check khong can token de monitor de dang. */
const PUBLIC_PATHS = ["/api/health"];

/**
 * Auth gate don gian cho local admin (Day 7 DoD).
 * - API_TOKEN trong khong co trong env -> guard TAT (local dev nhanh), log warn 1 lan.
 * - API_TOKEN co gia tri -> moi request (tru PUBLIC_PATHS) phai gui
 *   header `x-api-token` hoac `Authorization: Bearer <token>`.
 * So sanh bang timingSafeEqual de tranh timing attack.
 */
@Injectable()
export class ApiTokenGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(ApiTokenGuard.name);

  onModuleInit(): void {
    if (!process.env.API_TOKEN) {
      this.logger.warn("API_TOKEN chua duoc cau hinh - auth gate dang TAT (chi nen dung khi dev local)");
    } else {
      this.logger.log("Auth gate BAT - moi request can x-api-token");
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.API_TOKEN;
    if (!expected) return true; // guard tat

    const request = context.switchToHttp().getRequest<Request>();
    if (PUBLIC_PATHS.some((p) => request.path.startsWith(p))) return true;

    const provided = this.extractToken(request);
    if (provided && safeEquals(provided, expected)) return true;

    throw new UnauthorizedError();
  }

  private extractToken(request: Request): string | null {
    const headerToken = request.headers["x-api-token"];
    if (typeof headerToken === "string" && headerToken.length > 0) return headerToken;

    const auth = request.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);

    return null;
  }
}

/** timingSafeEqual yeu cau 2 buffer cung do dai — pad truoc khi so sanh. */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
