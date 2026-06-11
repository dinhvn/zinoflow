/** Mo rong Express Request de mang traceId do TraceMiddleware gan vao. */
declare namespace Express {
  interface Request {
    traceId?: string;
  }
}
