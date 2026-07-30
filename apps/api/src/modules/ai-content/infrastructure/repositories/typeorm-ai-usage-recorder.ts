import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "node:crypto";
import type { AiProviderKey } from "@zinoflow/contracts";
import type {
  AiUsageEntry,
  AiUsageRecorder,
} from "../../application/ports/ai-usage-recorder.port";
import { AiUsageLogEntity } from "../entities/ai-usage-log.entity";

@Injectable()
export class TypeOrmAiUsageRecorder implements AiUsageRecorder {
  constructor(
    @InjectRepository(AiUsageLogEntity)
    private readonly repo: Repository<AiUsageLogEntity>,
  ) {}

  async record(entry: AiUsageEntry): Promise<void> {
    const entity = new AiUsageLogEntity();
    entity.id = randomUUID();
    entity.jobId = entry.jobId;
    // "stub" ghi nhu provider anthropic se gay nhieu so lieu cost — luu dung nguon
    entity.provider = entry.provider as AiProviderKey;
    entity.model = entry.model;
    entity.operation = entry.operation;
    entity.inputTokens = entry.inputTokens;
    entity.outputTokens = entry.outputTokens;
    entity.costUsd = entry.costUsd.toFixed(6);
    entity.latencyMs = entry.latencyMs;
    entity.promptText = entry.promptText ?? null;
    entity.responseText = entry.responseText ?? null;
    entity.promptKey = entry.promptKey ?? null;
    entity.promptVersion = entry.promptVersion ?? null;
    entity.promptSource = entry.promptSource ?? null;
    entity.sourceContextHash = entry.sourceContextHash ?? null;
    entity.createdAt = new Date();
    await this.repo.save(entity);
  }
}
