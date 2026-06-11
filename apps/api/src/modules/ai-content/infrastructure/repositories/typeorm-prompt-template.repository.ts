import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  PromptTemplateRecord,
  PromptTemplateRepository,
} from "../../application/ports/prompt-template.repository";
import { PromptTemplateEntity } from "../entities/prompt-template.entity";

/** TypeORM implementation cua PromptTemplateRepository — chi doc version active moi nhat. */
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
    if (!entity) return null;
    return {
      id: entity.id,
      templateKey: entity.templateKey,
      version: entity.version,
      content: entity.content,
    };
  }
}
