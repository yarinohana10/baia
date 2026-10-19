import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { strictValidationPipe } from '../common/validation';
import { getOptionalUser } from '../common/session';
import { OrdersService } from '../orders/orders.service';
import { extractOrderToken } from '../orders/order-access';
import { CancellationsService } from './cancellations.service';
import {
  AdminCancellationsQueryDto,
  AdminCancelOrderDto,
  CancellationRequestDto,
  PublicCancellationDto,
  ResolveCancellationDto,
  SelfCancelDto,
} from './dto/cancellation.dto';

const MINUTE = 60_000;

@Controller()
@UseGuards(RateLimitGuard)
@UsePipes(strictValidationPipe)
export class CancellationsController {
  constructor(
    private readonly cancellations: CancellationsService,
    private readonly orders: OrdersService,
  ) {}

  /** Same ownership proof as GET /orders/:id (session owner or guest token/cookie); admins excluded. */
  private async assertOwner(req: Request, id: string) {
    const user = await getOptionalUser(req);
    await this.orders.assertAccess(id, { user, token: extractOrderToken(req, id) }, { allowAdmin: false });
  }

  /** Instant free cancellation inside the self-service window (or of an unpaid order). */
  @Post('orders/:id/cancel')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  async selfCancel(@Req() req: Request, @Param('id') id: string, @Body() body: SelfCancelDto) {
    await this.assertOwner(req, id);
    return this.cancellations.selfCancel(id, body);
  }

  /** A cancellation request the store reviews. */
  @Post('orders/:id/cancellation-request')
  @RateLimit({ limit: 5, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  async request(@Req() req: Request, @Param('id') id: string, @Body() body: CancellationRequestDto) {
    await this.assertOwner(req, id);
    return this.cancellations.createRequest(id, body);
  }

  /** Public /cancel-order form (order number + email). */
  @Post('cancellations')
  @RateLimit({ limit: 10, windowMs: 15 * MINUTE })
  @Header('Cache-Control', 'no-store')
  publicCancel(@Body() body: PublicCancellationDto) {
    return this.cancellations.publicCancel(body);
  }

  // ─── Admin ──────────────────────────────────────

  @Get('admin/cancellations')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  list(@Query() query: AdminCancellationsQueryDto) {
    return this.cancellations.list({
      status: query.status,
      page: Math.max(1, parseInt(query.page ?? '', 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(query.limit ?? '', 10) || 20)),
    });
  }

  @Put('admin/cancellations/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  resolve(@Param('id') id: string, @Body() body: ResolveCancellationDto) {
    return this.cancellations.resolve(id, body);
  }

  /** Cancel an order from the admin orders screen, optionally refunding through the provider. */
  @Post('admin/orders/:id/cancel')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  adminCancel(@Param('id') id: string, @Body() body: AdminCancelOrderDto) {
    return this.cancellations.adminCancelOrder(id, body);
  }
}
