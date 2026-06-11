import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { ErrorEnvelope } from "@zinoflow/contracts";
import { AppError } from "./app-error";

/**
 * Global exception filter — moi loi deu tra ve dung 1 format error envelope
 * (spec §12) kem traceId. Khong co loi nao "lot luoi" ra ngoai voi format khac.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = request.traceId ?? "unknown";

    const { status, envelope } = this.toEnvelope(exception, traceId);

    // Loi 5xx la loi he thong — log day du stack de debug; 4xx chi log warn gon
    if (status >= 500) {
      this.logger.error(
        `[${traceId}] ${request.method} ${request.url} -> ${status}: ${envelope.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`[${traceId}] ${request.method} ${request.url} -> ${status}: ${envelope.message}`);
    }

    response.status(status).json(envelope);
  }

  private toEnvelope(exception: unknown, traceId: string): { status: number; envelope: ErrorEnvelope } {
    if (exception instanceof AppError) {
      return {
        status: exception.httpStatus,
        envelope: {
          errorCode: exception.errorCode,
          message: exception.message,
          details: exception.details,
          traceId,
        },
      };
    }

    // HttpException cua Nest (404 route khong ton tai, ...) — map ve envelope
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        envelope: {
          errorCode: status < 500 ? "ValidationError" : "UnknownError",
          message: exception.message,
          details: [],
          traceId,
        },
      };
    }

    return {
      status: 500,
      envelope: {
        errorCode: "UnknownError",
        message: "Internal server error",
        details: [],
        traceId,
      },
    };
  }
}
