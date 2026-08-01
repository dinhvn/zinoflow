import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AiBatchItemStatus, AiBatchStatus, AiBatchTaskType } from "@zinoflow/contracts";
import type {
  AiBatchItemRecord,
  AiBatchRecord,
  AiBatchRepository,
} from "../../application/ports/ai-batch.repository";
import { AiBatchEntity } from "../entities/ai-batch.entity";
import { AiBatchItemEntity } from "../entities/ai-batch-item.entity";

@Injectable()
export class TypeOrmAiBatchRepository implements AiBatchRepository {
  constructor(
    @InjectRepository(AiBatchEntity) private readonly batches: Repository<AiBatchEntity>,
    @InjectRepository(AiBatchItemEntity) private readonly items: Repository<AiBatchItemEntity>,
  ) {}

  async createBatch(batch: AiBatchRecord): Promise<void> {
    await this.batches.save(this.batches.create(batch));
  }

  async createItems(items: AiBatchItemRecord[]): Promise<void> {
    if (items.length === 0) return;
    await this.items.save(items.map((item) => this.items.create(item)));
  }

  async findBatchById(id: string): Promise<AiBatchRecord | null> {
    return this.batches.findOneBy({ id });
  }

  async updateBatchStatus(id: string, status: AiBatchStatus, checkedAt: Date): Promise<void> {
    await this.batches.update({ id }, { status, checkedAt });
  }

  async findItemsByBatchId(batchId: string): Promise<AiBatchItemRecord[]> {
    return this.items.find({ where: { batchId }, order: { createdAt: "ASC" } });
  }

  async updateItemResult(
    id: string,
    status: AiBatchItemStatus,
    errorMessage: string | null,
  ): Promise<void> {
    await this.items.update({ id }, { status, errorMessage });
  }

  async listRecent(taskType?: AiBatchTaskType, limit = 50): Promise<AiBatchRecord[]> {
    return this.batches.find({
      where: taskType ? { taskType } : {},
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}
