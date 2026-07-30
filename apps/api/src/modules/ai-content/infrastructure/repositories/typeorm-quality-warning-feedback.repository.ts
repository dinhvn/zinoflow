import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  QualityWarningFeedbackRecord,
  QualityWarningFeedbackRepository,
} from "../../application/ports/quality-warning-feedback.repository";
import { QualityWarningFeedbackEntity } from "../entities/quality-warning-feedback.entity";

@Injectable()
export class TypeOrmQualityWarningFeedbackRepository implements QualityWarningFeedbackRepository {
  constructor(
    @InjectRepository(QualityWarningFeedbackEntity)
    private readonly repository: Repository<QualityWarningFeedbackEntity>,
  ) {}

  async create(record: QualityWarningFeedbackRecord): Promise<void> {
    await this.repository.save(this.repository.create(record));
  }
}
