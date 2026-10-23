import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRangeQueryDto, TopProductsQueryDto } from './analytics.dto';
import { AuthGuard, Roles } from '../auth/auth.guard';

/**
 * Admin analytics. Every range endpoint takes `preset` or `from`/`to`
 * (see AnalyticsRangeQueryDto) and reads the range in Israel time.
 */
@Controller('admin/analytics')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  getOverview() {
    return this.analytics.getOverview();
  }

  /** Headline metrics for the range plus the previous equal-length period and % change. */
  @Get('summary')
  async getSummary(@Query() q: AnalyticsRangeQueryDto) {
    return this.analytics.getSummary(await this.analytics.resolve(q));
  }

  @Get('sales')
  async getSales(@Query() q: AnalyticsRangeQueryDto) {
    return this.analytics.getSales(await this.analytics.resolve(q));
  }

  @Get('orders-by-status')
  async getOrdersByStatus(@Query() q: AnalyticsRangeQueryDto) {
    return this.analytics.getOrdersByStatus(await this.analytics.resolve(q));
  }

  @Get('top-products')
  async getTopProducts(@Query() q: TopProductsQueryDto) {
    return this.analytics.getTopProducts(await this.analytics.resolve(q), q.limit);
  }

  @Get('revenue-by-category')
  async getRevenueByCategory(@Query() q: AnalyticsRangeQueryDto) {
    return this.analytics.getRevenueByCategory(await this.analytics.resolve(q));
  }

  @Get('sales-breakdown')
  async getSalesBreakdown(@Query() q: AnalyticsRangeQueryDto) {
    return this.analytics.getSalesBreakdown(await this.analytics.resolve(q));
  }

  @Get('customer-growth')
  async getCustomerGrowth(@Query() q: AnalyticsRangeQueryDto) {
    return this.analytics.getCustomerGrowth(await this.analytics.resolve(q));
  }

  @Get('inventory')
  getInventoryOverview() {
    return this.analytics.getInventoryOverview();
  }

  /** Work waiting on the admin; independent of any range. */
  @Get('needs-attention')
  getNeedsAttention() {
    return this.analytics.getNeedsAttention();
  }

  /** Orders created in the range, as CSV. */
  @Get('export')
  async exportOrders(@Query() q: AnalyticsRangeQueryDto, @Res() res: Response) {
    const range = await this.analytics.resolve(q);
    const csv = await this.analytics.exportOrdersCsv(range);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="baia-orders-${range.fromDay}_${range.toDay}.csv"`);
    res.send(csv);
  }
}
