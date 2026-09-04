import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard, Roles } from '../auth/auth.guard';

@Controller('admin/analytics')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('sales')
  getSales(@Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getSales(Number.isNaN(parsedDays) ? 30 : parsedDays);
  }
}
