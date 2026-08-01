import { Injectable, Logger } from "@nestjs/common";
import type {
  BatchTaskHandler,
  BatchTaskHandlerRegistry,
} from "../../application/ports/batch-task-handler.port";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Registry cho BatchTaskHandler — Map don gian, KHONG biet truoc co nhung
 * handler nao. Moi handler (dinh nghia o module so huu no, vd DestinationModule)
 * tu goi register() trong onModuleInit() cua chinh no — tranh vong lap module
 * (xem docs/specs/ai-batch-mode.md).
 */
@Injectable()
export class DefaultBatchTaskHandlerRegistry implements BatchTaskHandlerRegistry {
  private readonly logger = new Logger(DefaultBatchTaskHandlerRegistry.name);
  private readonly handlers = new Map<string, BatchTaskHandler>();

  register(handler: BatchTaskHandler): void {
    this.handlers.set(handler.taskType, handler);
    this.logger.log(`Batch task handler đăng ký: ${handler.taskType}`);
  }

  resolve(taskType: string): BatchTaskHandler {
    const handler = this.handlers.get(taskType);
    if (!handler) {
      throw new DomainRuleError(`Chưa có handler cho taskType "${taskType}"`, [
        `Đã đăng ký: ${[...this.handlers.keys()].join(", ") || "(chưa có handler nào)"}`,
      ]);
    }
    return handler;
  }
}
