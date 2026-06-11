import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthModule } from "./modules/shared/health/health.module";
import { JobsModule } from "./modules/shared/jobs/jobs.module";
import { AiContentModule } from "./modules/ai-content/ai-content.module";
import { AppExceptionFilter } from "./modules/shared/errors/app-exception.filter";
import { TraceMiddleware } from "./modules/shared/observability/trace.middleware";
import { ApiTokenGuard } from "./modules/shared/auth/api-token.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Tu Day 3, DATABASE_URL la BAT BUOC (ai-content luu data qua TypeORM).
    // main.ts da fail-fast voi message ro rang neu thieu.
    TypeOrmModule.forRoot({
      type: "postgres",
      url: process.env.DATABASE_URL,
      // Entities tu dong load tu cac module dung TypeOrmModule.forFeature
      autoLoadEntities: true,
      // TUYET DOI khong dung synchronize — schema thay doi qua migration co review
      synchronize: false,
    }),
    JobsModule,
    HealthModule,
    AiContentModule,
  ],
  providers: [
    // Global: moi loi deu tra ve error envelope chuan kem traceId (spec §12)
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    // Auth gate: bat khi API_TOKEN co trong env (xem api-token.guard.ts)
    { provide: APP_GUARD, useClass: ApiTokenGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes("*");
  }
}
