import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "node:crypto";
import type { QualityCheck, QualityGateName } from "@zinoflow/contracts";
import type { QualityResultRepository } from "../../application/ports/quality-result.repository";
import { ContentQualityResultEntity } from "../entities/content-quality-result.entity";

/** TypeORM implementation — moi lan chay checks ghi de ket qua cu cua draft. */
@Injectable()
export class TypeOrmQualityResultRepository implements QualityResultRepository {
  constructor(
    @InjectRepository(ContentQualityResultEntity)
    private readonly repo: Repository<ContentQualityResultEntity>,
  ) {}

  async replaceForDraft(draftId: string, checks: readonly QualityCheck[]): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.delete(ContentQualityResultEntity, { draftId });
      const now = new Date();
      const entities = checks.map((check) => {
        const entity = new ContentQualityResultEntity();
        entity.id = randomUUID();
        entity.draftId = draftId;
        entity.gateName = check.gateName;
        entity.passed = check.passed;
        entity.details = [...check.details];
        entity.createdAt = now;
        return entity;
      });
      await manager.save(entities);
    });
  }

  async findByDraftId(draftId: string): Promise<QualityCheck[]> {
    const entities = await this.repo.find({ where: { draftId }, order: { gateName: "ASC" } });
    return entities.map((e) => ({
      gateName: e.gateName as QualityGateName,
      passed: e.passed,
      details: e.details,
    }));
  }
}
