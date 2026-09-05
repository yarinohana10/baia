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

  @Get('orders-by-status')
  getOrdersByStatus() {
    return this.analyticsService.getOrdersByStatus();
  }

  @Get('top-products')
  getTopProducts(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getTopProducts(Number.isNaN(parsedLimit) ? 10 : parsedLimit);
  }

  @Get('revenue-by-category')
  getRevenueByCategory() {
    return this.analyticsService.getRevenueByCategory();
  }

  @Get('customer-growth')
  getCustomerGrowth(@Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getCustomerGrowth(Number.isNaN(parsedDays) ? 30 : parsedDays);
  }

  @Get('average-order-value')
  getAverageOrderValue(@Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getAverageOrderValue(Number.isNaN(parsedDays) ? 30 : parsedDays);
  }
}
