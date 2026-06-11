import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthModule } from "./modules/shared/health/health.module";
import { JobsModule } from "./modules/shared/jobs/jobs.module";
import { AiContentModule } from "./modules/ai-content/ai-content.module";
import { AppExceptionFilter } from "./modules/shared/errors/app-exception.filter";
import { TraceMiddleware } from "./modules/shared/observability/trace.middleware";

/**
 * TypeORM chi duoc bat khi DATABASE_URL co trong env.
 * Ly do: cho phep app boot duoc tren may chua setup Postgres (vd: CI typecheck,
 * lan chay dau tien truoc khi tao database). Khi DATABASE_URL trong, health
 * endpoint van song nhung cac module can DB se khong hoat dong.
 */
const databaseUrl = process.env.DATABASE_URL;

const conditionalImports = databaseUrl
  ? [
      TypeOrmModule.forRoot({
        type: "postgres",
        url: databaseUrl,
        // Entities tu dong load tu cac module dung TypeOrmModule.forFeature
        autoLoadEntities: true,
        // TUYET DOI khong dung synchronize — schema thay doi qua migration co review
        synchronize: false,
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...conditionalImports,
    JobsModule,
    HealthModule,
    AiContentModule,
  ],
  providers: [
    // Global: moi loi deu tra ve error envelope chuan kem traceId (spec §12)
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes("*");
  }
}
