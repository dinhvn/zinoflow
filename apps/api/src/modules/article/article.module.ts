import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiContentModule } from "../ai-content/ai-content.module";
import { DestinationModule } from "../destination/destination.module";
import { HotelModule } from "../hotel/hotel.module";
import { TourModule } from "../tour/tour.module";
import { ProductModule } from "../product/product.module";
import { ContentImageModule } from "../content-image/content-image.module";
import { ArticlesController } from "./presentation/articles.controller";
import { ArticleBlockCompiler } from "./application/services/article-block-compiler.service";
import { ArticleAutoLinkService } from "./application/services/article-auto-link.service";
import { PublishArticleUseCase } from "./application/use-cases/publish-article.usecase";
import { PreviewArticleUseCase } from "./application/use-cases/preview-article.usecase";
import { RefreshDynamicBlocksUseCase } from "./application/use-cases/refresh-dynamic-blocks.usecase";
import { RefreshAllDynamicBlocksUseCase } from "./application/use-cases/refresh-all-dynamic-blocks.usecase";
import { GetArticleDestinationMapUseCase } from "./application/use-cases/get-article-destination-map.usecase";
import { SaveArticleDestinationMapUseCase } from "./application/use-cases/save-article-destination-map.usecase";
import { SetArticleCoverImageUseCase } from "./application/use-cases/set-article-cover-image.usecase";
import { ARTICLE_SITE_DB } from "./application/ports/article-site-db.port";
import { ARTICLE_PUBLICATION_REPOSITORY } from "./application/ports/article-publication.repository";
import { MssqlArticleSiteDbAdapter } from "./infrastructure/dichoithoi/mssql-article-site-db.adapter";
import { TypeOrmArticlePublicationRepository } from "./infrastructure/repositories/typeorm-article-publication.repository";
import { ArticlePublicationEntity } from "./infrastructure/entities/article-publication.entity";

/**
 * Module Article (M4 Phase 8) — bai tong hop/cam nang voi khoi dong compile
 * san (dichoithoi-article-spec.md). Tai dung pipeline ai-content (job/draft/
 * review/quality gates) — module nay CHI them engine compile + publisher rieng.
 */
@Module({
  imports: [
    AiContentModule,
    DestinationModule,
    HotelModule,
    TourModule,
    ProductModule,
    ContentImageModule,
    TypeOrmModule.forFeature([ArticlePublicationEntity]),
  ],
  controllers: [ArticlesController],
  providers: [
    ArticleBlockCompiler,
    ArticleAutoLinkService,
    PublishArticleUseCase,
    PreviewArticleUseCase,
    RefreshDynamicBlocksUseCase,
    RefreshAllDynamicBlocksUseCase,
    GetArticleDestinationMapUseCase,
    SaveArticleDestinationMapUseCase,
    SetArticleCoverImageUseCase,
    { provide: ARTICLE_SITE_DB, useClass: MssqlArticleSiteDbAdapter },
    { provide: ARTICLE_PUBLICATION_REPOSITORY, useClass: TypeOrmArticlePublicationRepository },
  ],
})
export class ArticleModule {}
