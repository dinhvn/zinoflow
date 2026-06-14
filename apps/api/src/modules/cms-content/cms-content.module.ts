import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CmsContentController } from "./presentation/cms-content.controller";
import { CmsPostMirrorEntity } from "./infrastructure/entities/cms-post-mirror.entity";
import { CMS_POST_MIRROR_REPOSITORY } from "./application/ports/cms-post-mirror.repository";
import { TypeOrmCmsPostMirrorRepository } from "./infrastructure/repositories/typeorm-cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB } from "./application/ports/khuyenmai-cms-db.port";
import { MssqlCmsDbAdapter } from "./infrastructure/khuyenmai/mssql-cms-db.adapter";
import { CMS_REFERENCE_FETCHER } from "./application/ports/cms-reference-fetcher.port";
import { HttpReferenceFetcher } from "../destination/infrastructure/reference/http-reference-fetcher";
import { SyncCmsPostsUseCase } from "./application/use-cases/sync-cms-posts.usecase";
import { ListCmsPostsUseCase } from "./application/use-cases/list-cms-posts.usecase";
import { GetCmsPostDetailUseCase } from "./application/use-cases/get-cms-post-detail.usecase";
import { CreateCmsContentJobUseCase } from "./application/use-cases/create-cms-content-job.usecase";
import { WriteContentToCmsUseCase } from "./application/use-cases/write-content-to-cms.usecase";
import { CreateCmsPostUseCase } from "./application/use-cases/create-cms-post.usecase";
import { AiContentModule } from "../ai-content/ai-content.module";

/**
 * Khu CMS khuyenmai (laruki + dochoi3s) — tao content AI ghi thang DB CMS (phuong an R).
 * Spec: docs/specs/laruki-dochoi3s-content-spec.md.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CmsPostMirrorEntity]), AiContentModule],
  controllers: [CmsContentController],
  providers: [
    SyncCmsPostsUseCase,
    ListCmsPostsUseCase,
    GetCmsPostDetailUseCase,
    CreateCmsContentJobUseCase,
    WriteContentToCmsUseCase,
    CreateCmsPostUseCase,
    { provide: CMS_POST_MIRROR_REPOSITORY, useClass: TypeOrmCmsPostMirrorRepository },
    { provide: KHUYENMAI_CMS_DB, useClass: MssqlCmsDbAdapter },
    // HttpReferenceFetcher la utility thuan (fetch tinh + SSRF guard) — tai dung tu module destination
    { provide: CMS_REFERENCE_FETCHER, useClass: HttpReferenceFetcher },
  ],
})
export class CmsContentModule {}
