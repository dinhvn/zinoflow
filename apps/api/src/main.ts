import "reflect-metadata";
import "dotenv/config"; // load .env truoc khi AppModule duoc evaluate (TypeORM conditional)
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { warnAboutProductionEndpoints } from "./modules/shared/observability/production-endpoint-warning";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  warnAboutProductionEndpoints(logger);

  if (!process.env.DATABASE_URL) {
    logger.error(
      "DATABASE_URL is required. Copy apps/api/.env.example -> .env, dien password Postgres va tao database: CREATE DATABASE zinoflow;",
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // Gioi han mac dinh cua Express (100kb) qua nho cho cac request duyet/chap
  // nhan hang loat (vd Chap nhan ~400 ket qua tim toa do cung luc — moi selection
  // chua ca placeId la URL Google Maps dai — bug thuc te 09/08/2026: "tick khoang
  // 400 item thi khong chay duoc" -> PayloadTooLargeError).
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  app.setGlobalPrefix("api");
  // Validation: dung Zod schema tu @zinoflow/contracts qua custom pipe (Day 2),
  // KHONG dung class-validator/ValidationPipe — tranh 2 he validation song song.
  // Web (Next.js) chay o port khac trong dev nen can CORS
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3005" });

  // Swagger docs tai /docs (yeu cau spec §16.4 — API docs co examples)
  const swaggerConfig = new DocumentBuilder()
    .setTitle("ZinoFlow API")
    .setDescription("AI Content Tool API")
    .setVersion("0.1.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api (docs: /docs)`);
}

void bootstrap();
