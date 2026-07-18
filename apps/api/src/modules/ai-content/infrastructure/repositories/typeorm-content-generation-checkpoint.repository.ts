import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ContentSection } from "@zinoflow/contracts";
import type {
  ContentGenerationCheckpointRepository,
  GenerationCheckpoint,
} from "../../application/ports/content-generation-checkpoint.repository";
import type { OutlineLike } from "../../application/services/article-type-profiles";
import { ContentGenerationCheckpointEntity } from "../entities/content-generation-checkpoint.entity";

@Injectable()
export class TypeOrmContentGenerationCheckpointRepository
  implements ContentGenerationCheckpointRepository
{
  constructor(
    @InjectRepository(ContentGenerationCheckpointEntity)
    private readonly repo: Repository<ContentGenerationCheckpointEntity>,
  ) {}

  async findByJobId(jobId: string): Promise<GenerationCheckpoint | null> {
    const entity = await this.repo.findOneBy({ jobId });
    if (!entity) return null;
    return {
      jobId: entity.jobId,
      // jsonb da duoc validate bang Zod truoc khi luu — cast lai dung type
      outline: entity.outlineJson as (OutlineLike & Record<string, unknown>) | null,
      sections: entity.sectionsJson as ContentSection[],
    };
  }

  async save(checkpoint: GenerationCheckpoint): Promise<void> {
    const entity = new ContentGenerationCheckpointEntity();
    entity.jobId = checkpoint.jobId;
    entity.outlineJson = checkpoint.outline;
    entity.sectionsJson = checkpoint.sections;
    entity.updatedAt = new Date();
    await this.repo.save(entity);
  }

  async clear(jobId: string): Promise<void> {
    await this.repo.delete({ jobId });
  }
}
