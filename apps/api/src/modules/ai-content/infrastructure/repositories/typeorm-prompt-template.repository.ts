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

  async findVersions(templateKey: string): Promise<PromptTemplateVersionRecord[]> {
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
    return this.repo.manager.transaction(async (manager) => {
      const tx = manager.getRepository(PromptTemplateEntity);
      const max = await tx
        .createQueryBuilder("t")
        .select("MAX(t.version)", "max")
        .where("t.template_key = :templateKey", { templateKey })
        .getRawOne<{ max: number | null }>();
      const nextVersion = (max?.max ?? 0) + 1;

      // Chi 1 version active / key — tat het truoc khi bat ban moi
      await tx.update({ templateKey }, { isActive: false });
      const entity = tx.create({
        id: randomUUID(),
        templateKey,
        version: nextVersion,
        content,
        isActive: true,
        createdAt: new Date(),
      });
      await tx.save(entity);
      return toVersionRecord(entity);
    });
  }

  async activateVersion(templateKey: string, version: number): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      const tx = manager.getRepository(PromptTemplateEntity);
      await tx.update({ templateKey }, { isActive: false });
      await tx.update({ templateKey, version }, { isActive: true });
    });
  }
}

function toRecord(e: PromptTemplateEntity): PromptTemplateRecord {
  return { id: e.id, templateKey: e.templateKey, version: e.version, content: e.content };
}

function toVersionRecord(e: PromptTemplateEntity): PromptTemplateVersionRecord {
  return { ...toRecord(e), isActive: e.isActive, createdAt: e.createdAt };
}
