import { Module } from "@nestjs/common";
import { AiContentModule } from "../ai-content/ai-content.module";
import { DestinationModule } from "../destination/destination.module";
import { CmsContentModule } from "../cms-content/cms-content.module";
import { DashboardController } from "./presentation/dashboard.controller";
import { GetDashboardSummaryUseCase } from "./application/get-dashboard-summary.usecase";

/**
 * Dashboard trang chu — gom du lieu tu ai-content (jobs + cost), destination
 * (dichoithoi), cms-content (laruki/dochoi3s). Chi doc, khong so huu bang nao.
 */
@Module({
  imports: [AiContentModule, DestinationModule, CmsContentModule],
  controllers: [DashboardController],
  providers: [GetDashboardSummaryUseCase],
})
export class DashboardModule {}
