import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export const TRACE_HEADER = "x-trace-id";

/**
 * Gan traceId cho moi request (giu traceId tu client neu da co — phuc vu
 * trace xuyen he thong). traceId xuat hien trong response header va trong
 * moi error envelope de doi chieu voi log.
 */
@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[TRACE_HEADER];
    const traceId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    req.traceId = traceId;
    res.setHeader(TRACE_HEADER, traceId);
    next();
  }
}
