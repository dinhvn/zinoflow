import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AiBatchItemStatus, AiBatchStatus, AiBatchTaskType } from "@zinoflow/contracts";
import type {
  AiBatchItemRecord,
  AiBatchRecord,
  AiBatchRepository,
  AiBatchUsageTotals,
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
    await this.items.save(
      items.map((item) =>
        this.items.create({ ...item, costUsd: item.costUsd === null ? null : String(item.costUsd) }),
      ),
    );
  }

  async findBatchById(id: string): Promise<AiBatchRecord | null> {
    return this.batches.findOneBy({ id });
  }

  async updateBatchStatus(id: string, status: AiBatchStatus, checkedAt: Date): Promise<void> {
    await this.batches.update({ id }, { status, checkedAt });
  }

  async findItemsByBatchId(batchId: string): Promise<AiBatchItemRecord[]> {
    const rows = await this.items.find({ where: { batchId }, order: { createdAt: "ASC" } });
    return rows.map(toItemRecord);
  }

  async updateItemResult(
    id: string,
    status: AiBatchItemStatus,
    errorMessage: string | null,
    usage?: { inputTokens: number; outputTokens: number; costUsd: number } | null,
  ): Promise<void> {
    await this.items.update(
      { id },
      {
        status,
        errorMessage,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        costUsd: usage ? String(usage.costUsd) : null,
      },
    );
  }

  async listRecent(taskType?: AiBatchTaskType, limit = 50): Promise<AiBatchRecord[]> {
    return this.batches.find({
      where: taskType ? { taskType } : {},
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async countFailedItemsByBatchIds(batchIds: string[]): Promise<Record<string, number>> {
    if (batchIds.length === 0) return {};
    const rows = await this.items
      .createQueryBuilder("item")
      .select("item.batchId", "batchId")
      .addSelect("COUNT(*)", "count")
      .where("item.batchId IN (:...batchIds)", { batchIds })
      .andWhere("item.status = :status", { status: "failed" })
      .groupBy("item.batchId")
      .getRawMany<{ batchId: string; count: string }>();
    return Object.fromEntries(rows.map((r) => [r.batchId, Number(r.count)]));
  }

  async sumUsageByBatchIds(batchIds: string[]): Promise<Record<string, AiBatchUsageTotals>> {
    if (batchIds.length === 0) return {};
    const rows = await this.items
      .createQueryBuilder("item")
      .select("item.batchId", "batchId")
      .addSelect("COALESCE(SUM(item.inputTokens), 0)", "inputTokens")
      .addSelect("COALESCE(SUM(item.outputTokens), 0)", "outputTokens")
      .addSelect("COALESCE(SUM(item.costUsd), 0)", "costUsd")
      .where("item.batchId IN (:...batchIds)", { batchIds })
      .andWhere("item.status = :status", { status: "succeeded" })
      .groupBy("item.batchId")
      .getRawMany<{ batchId: string; inputTokens: string; outputTokens: string; costUsd: string }>();
    return Object.fromEntries(
      rows.map((r) => [
        r.batchId,
        { inputTokens: Number(r.inputTokens), outputTokens: Number(r.outputTokens), costUsd: Number(r.costUsd) },
      ]),
    );
  }
}

function toItemRecord(entity: AiBatchItemEntity): AiBatchItemRecord {
  return { ...entity, costUsd: entity.costUsd === null ? null : Number(entity.costUsd) };
}
