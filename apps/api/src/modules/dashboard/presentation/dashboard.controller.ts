import { Controller, Get } from "@nestjs/common";
import type { DashboardSummaryResponse } from "@zinoflow/contracts";
import { GetDashboardSummaryUseCase } from "../application/get-dashboard-summary.usecase";

/** Tong hop trang chu — 1 endpoint cho toan bo dashboard. */
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly summary: GetDashboardSummaryUseCase) {}

  @Get("summary")
  getSummary(): Promise<DashboardSummaryResponse> {
    return this.summary.execute();
  }
}
