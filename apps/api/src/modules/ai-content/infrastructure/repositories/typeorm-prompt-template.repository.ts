import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { randomUUID } from "node:crypto";
import type {
  PromptTemplateRecord,
  PromptTemplateRepository,
  PromptTemplateVersionRecord,
} from "../../application/ports/prompt-template.repository";
import { PromptTemplateEntity } from "../entities/prompt-template.entity";

/** TypeORM implementation cua PromptTemplateRepository (M2 + man quan ly prompt). */
@Injectable()
export class TypeOrmPromptTemplateRepository implements PromptTemplateRepository {
  constructor(
    @InjectRepository(PromptTemplateEntity)
    private readonly repo: Repository<PromptTemplateEntity>,
  ) {}

  async findActive(templateKey: string): Promise<PromptTemplateRecord | null> {
    const entity = await this.repo.findOne({
      where: { templateKey, isActive: true },
      order: { version: "DESC" },
    });
    return entity ? toRecord(entity) : null;
  }

  async findActiveMany(
    templateKeys: readonly string[],
  ): Promise<PromptTemplateVersionRecord[]> {
    if (templateKeys.length === 0) return [];
    const entities = await this.repo.find({
      where: { templateKey: In([...templateKeys]), isActive: true },
    });
    return entities.map(toVersionRecord);
  }

  async findLatestMany(
    templateKeys: readonly string[],
  ): Promise<PromptTemplateVersionRecord[]> {
    if (templateKeys.length === 0) return [];
    const entities = await this.repo
      .createQueryBuilder("t")
      .distinctOn(["t.template_key"])
      .where("t.template_key IN (:...templateKeys)", {
        templateKeys: [...templateKeys],
      })
      .orderBy("t.template_key", "ASC")
      .addOrderBy("t.version", "DESC")
      .getMany();
    return entities.map(toVersionRecord);
  }

  async findVersions(
    templateKey: string,
  ): Promise<PromptTemplateVersionRecord[]> {
    const entities = await this.repo.find({
      where: { templateKey },
      order: { version: "DESC" },
    });
    return entities.map(toVersionRecord);
  }

  async createVersion(
    templateKey: string,
    content: string,
  ): Promise<PromptTemplateVersionRecord> {
    return this.createVersionWithActivation(templateKey, content, true);
  }

  async createInactiveVersion(
    templateKey: string,
    content: string,
  ): Promise<PromptTemplateVersionRecord> {
    return this.createVersionWithActivation(templateKey, content, false);
  }

  private async createVersionWithActivation(
    templateKey: string,
    content: string,
    activate: boolean,
  ): Promise<PromptTemplateVersionRecord> {
    return this.repo.manager.transaction(async (manager) => {
      const tx = manager.getRepository(PromptTemplateEntity);
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        templateKey,
      ]);
      const max = await tx
        .createQueryBuilder("t")
        .select("MAX(t.version)", "max")
        .where("t.template_key = :templateKey", { templateKey })
        .getRawOne<{ max: number | null }>();
      const nextVersion = (max?.max ?? 0) + 1;

      if (activate) {
        await tx.update({ templateKey }, { isActive: false });
      }
      const entity = tx.create({
        id: randomUUID(),
        templateKey,
        version: nextVersion,
        content,
        isActive: activate,
        createdAt: new Date(),
      });
      await tx.save(entity);
      return toVersionRecord(entity);
    });
  }

  async activateVersion(
    templateKey: string,
    version: number,
    expectedActiveVersion: number | null,
  ): Promise<boolean> {
    return this.repo.manager.transaction(async (manager) => {
      const tx = manager.getRepository(PromptTemplateEntity);
      const rows = await tx
        .createQueryBuilder("t")
        .where("t.template_key = :templateKey", { templateKey })
        .setLock("pessimistic_write")
        .getMany();
      const activeVersion = rows.find((row) => row.isActive)?.version ?? null;
      if (activeVersion !== expectedActiveVersion) return false;

      await tx.update({ templateKey }, { isActive: false });
      await tx.update({ templateKey, version }, { isActive: true });
      return true;
    });
  }
}

function toRecord(e: PromptTemplateEntity): PromptTemplateRecord {
  return {
    id: e.id,
    templateKey: e.templateKey,
    version: e.version,
    content: e.content,
  };
}

function toVersionRecord(e: PromptTemplateEntity): PromptTemplateVersionRecord {
  return { ...toRecord(e), isActive: e.isActive, createdAt: e.createdAt };
}
