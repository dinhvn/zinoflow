import { Controller, Get, Optional } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

interface HealthResponse {
  status: "ok";
  uptimeSeconds: number;
  /** "connected" | "disconnected" | "not_configured" (chua co DATABASE_URL) */
  database: string;
}

@Controller("health")
export class HealthController {
  constructor(
    // Optional: app van boot duoc khi TypeORM khong duoc dang ky (chua co DATABASE_URL)
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    let database = "not_configured";
    if (this.dataSource) {
      try {
        await this.dataSource.query("SELECT 1");
        database = "connected";
      } catch {
        database = "disconnected";
      }
    }
    return {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      database,
    };
  }
}
