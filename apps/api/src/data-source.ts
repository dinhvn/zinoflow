import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";

/**
 * DataSource danh rieng cho TypeORM CLI (migration:generate / migration:run).
 * Runtime app dung TypeOrmModule trong app.module.ts — giu 2 noi dong bo ve config.
 */
export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: ["src/modules/**/infrastructure/entities/*.entity.ts"],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});
