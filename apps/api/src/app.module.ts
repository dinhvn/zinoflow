import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthModule } from "./modules/shared/health/health.module";

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
    HealthModule,
  ],
})
export class AppModule {}
