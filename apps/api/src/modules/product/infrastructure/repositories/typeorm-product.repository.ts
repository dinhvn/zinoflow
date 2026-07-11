import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProductEntity } from "../entities/product.entity";
import type {
  ProductRecord,
  ProductRepository as IProductRepository,
  UpsertProductInput,
} from "../../application/ports/product.repository";

function toRecord(e: ProductEntity): ProductRecord {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    tags: e.tags,
    thumbnailUrl: e.thumbnailUrl,
    thumbnailSourceUrl: e.thumbnailSourceUrl,
    price: e.price === null ? null : Number(e.price),
    provider: e.provider,
    sourceUrl: e.sourceUrl,
    affiliateUrl: e.affiliateUrl,
    linkStatus: e.linkStatus,
    source: e.source,
    status: e.status,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/** Cot decimal cua entity la string — chuyen tu number cua input truoc khi ghi */
function toColumns(input: UpsertProductInput): Partial<ProductEntity> {
  return {
    ...input,
    price: input.price === null ? null : input.price.toString(),
  };
}

@Injectable()
export class TypeOrmProductRepository implements IProductRepository {
  constructor(
    @InjectRepository(ProductEntity) private readonly repo: Repository<ProductEntity>,
  ) {}

  async findAll(): Promise<ProductRecord[]> {
    return (await this.repo.find({ order: { name: "ASC" } })).map(toRecord);
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const e = await this.repo.findOneBy({ id });
    return e ? toRecord(e) : null;
  }

  async create(input: UpsertProductInput): Promise<ProductRecord> {
    const saved = await this.repo.save(this.repo.create(toColumns(input)));
    return toRecord(saved);
  }

  async update(id: string, input: UpsertProductInput): Promise<ProductRecord> {
    await this.repo.update({ id }, toColumns(input));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Product id=${id} bien mat sau update`);
    return updated;
  }
}
