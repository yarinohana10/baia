import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { getOptionalUser } from '../common/session';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { strictValidationPipe } from '../common/validation';
import { secureCookieOptions } from '../common/cookies';
import { readGuestCartKeyHash, type CartOwner } from '../cart/cart-identity';
import {
  AdminOrdersExportQueryDto,
  AdminOrdersQueryDto,
  AdminRefundsQueryDto,
  CompleteRefundDto,
  CreateOrderDto,
  FailRefundDto,
  OrderAccessDto,
  OrderLookupDto,
  ResendOrderEmailDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrderMailer } from './order-mailer';
import type { OrderStatus, RefundStatus } from '../generated/prisma';
import { RefundsService } from './refunds.service';
import { PaymentsEnabledGuard } from '../payment/payments-enabled';
import { addDays, startOfDay } from '../analytics/date-range';
import type { AuthenticatedRequest } from '../common/session';
import {
  ORDER_ACCESS_COOKIE_MAX_AGE_MS,
  extractOrderToken,
  orderAccessCookieName,
  orderTokenExpiry,
} from './order-access';

const MINUTE = 60_000;

@Controller()
@UseGuards(RateLimitGuard)
@UsePipes(strictValidationPipe)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderMailer: OrderMailer,
    private readonly refunds: RefundsService,
  ) {}

  @Post('orders')
  @UseGuards(PaymentsEnabledGuard)
  @RateLimit({ limit: 10, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  async createOrder(@Req() req: Request, @Body() body: CreateOrderDto) {
    const user = await getOptionalUser(req);

    let owner: CartOwner;
    if (user) {
      owner = { userId: user.id };
    } else {
      const guestKeyHash = readGuestCartKeyHash(req);
      if (!guestKeyHash) throw new BadRequestException('Cart is empty');
      owner = { guestKeyHash };
    }

    const customerEmail = body.customerEmail ?? user?.email;
    if (!customerEmail) throw new BadRequestException('customerEmail is required');

    const { order, accessToken } = await this.ordersService.createOrder({
      owner,
      customerEmail,
      recipientName: body.recipientName,
      phone: body.phone,
      locale: body.locale,
      couponCode: body.couponCode,
      deliveryMethod: body.deliveryMethod,
      pickupPointId: body.pickupPointId,
      marketingConsent: body.marketingConsent,
      shippingCity: body.shippingCity,
      shippingStreet: body.shippingStreet,
      shippingNumber: body.shippingNumber,
      shippingApartment: body.shippingApartment,
      shippingZip: body.shippingZip,
    });

    // accessToken is returned exactly once and only for guest orders.
    return accessToken ? { ...order, accessToken } : order;
  }

  /**
   * Shipping options (price + ETA per delivery method) for the caller's
   * current cart. The order total is always recomputed at POST /orders.
   */
  @Get('checkout/quote')
  @RateLimit({ limit: 60, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  async quote(@Req() req: Request) {
    const user = await getOptionalUser(req);
    const guestKeyHash = user ? undefined : readGuestCartKeyHash(req);
    const owner: CartOwner | null = user ? { userId: user.id } : guestKeyHash ? { guestKeyHash } : null;
    return this.ordersService.quote(owner);
  }

  /**
   * Order lookup by order number + email (order-status / cancel-order
   * pages). Strictly rate-limited; every mismatch is the same 404. On a match
   * it returns a signed access token: the client navigates to
   * /order-confirmation/:id#token=..., which exchanges it for the scoped
   * cookie exactly like the post-checkout flow (see order-access.ts).
   */
  @Post('orders/lookup')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: 15 * MINUTE })
  @Header('Cache-Control', 'no-store')
  async lookup(@Body() body: OrderLookupDto) {
    const { orderId, accessToken } = await this.ordersService.lookup(body.orderNumber, body.email);
    return { order: await this.ordersService.findForCustomer(orderId), accessToken };
  }

  // Customer: my orders (bound to the session user only)
  @Get('orders/my')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  async myOrders(@Req() req: Request, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.ordersService.findByUser((req as Request & { user: { id: string } }).user.id, {
      page: Math.max(1, parseInt(page ?? '', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit ?? '', 10) || 20)),
    });
  }

  /**
   * Exchange a guest access token (from the confirmation URL fragment) for an
   * httpOnly cookie scoped to this order's path, and return the order.
   */
  @Post('orders/:id/access')
  @HttpCode(200)
  @RateLimit({ limit: 20, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  async exchangeAccessToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Body() body: OrderAccessDto,
  ) {
    const user = await getOptionalUser(req);
    const access = await this.ordersService.assertAccess(id, { user, token: body.token }, { allowAdmin: false });

    // Owners with a session need no cookie; token holders get one that never
    // outlives the token (creation token or signed link).
    const expiresAt = orderTokenExpiry(access, body.token);
    if (expiresAt) {
      const remaining = expiresAt.getTime() - Date.now();
      res.cookie(
        orderAccessCookieName(id),
        body.token,
        secureCookieOptions({
          path: `/v1/orders/${encodeURIComponent(id)}`,
          maxAge: Math.max(0, Math.min(ORDER_ACCESS_COOKIE_MAX_AGE_MS, remaining)),
        }),
      );
    }
    return this.ordersService.findForCustomer(id);
  }

  @Get('orders/:id')
  @RateLimit({ limit: 30, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  async getOrder(@Req() req: Request, @Param('id') id: string) {
    const user = await getOptionalUser(req);
    return this.ordersService.findForRequester(id, { user, token: extractOrderToken(req, id) });
  }

  // ─── Admin ──────────────────────────────────────

  @Get('admin/orders')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findAll(@Query() query: AdminOrdersQueryDto) {
    const { status, search, page, limit } = query;
    return this.ordersService.findAll({
      status,
      search: search || undefined,
      ...israelDayRange(query.from, query.to),
      page: page ? Math.max(1, parseInt(page) || 1) : 1,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit) || 20)) : 20,
    });
  }

  /** Orders CSV for a date range (dashboard "Export"). */
  @Get('admin/orders/export')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Header('Cache-Control', 'no-store')
  async exportCsv(@Query() query: AdminOrdersExportQueryDto, @Res() res: Response) {
    const csv = await this.ordersService.exportCsv({
      ...israelDayRange(query.from, query.to),
      status: query.status,
      search: query.search || undefined,
    });
    const name = `orders-${query.from ?? 'all'}-${query.to ?? new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^A-Za-z0-9._-]/g, '')}"`);
    res.send(csv);
  }

  @Get('admin/orders/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async findById(@Param('id') id: string) {
    return this.withTransitions(await this.ordersService.findForAdmin(id));
  }

  /** Emails sent about this order (EmailLog), newest first. */
  @Get('admin/orders/:id/emails')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Header('Cache-Control', 'no-store')
  emails(@Param('id') id: string) {
    return this.orderMailer.emailLogs(id);
  }

  /** Re-sends the customer's order confirmation (paid orders only; 409 otherwise). */
  @Post('admin/orders/:id/resend-confirmation')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @RateLimit({ limit: 10, windowMs: MINUTE })
  async resendConfirmation(@Param('id') id: string) {
    return this.orderMailer.resendConfirmation(id);
  }

  /** Re-renders any order email from the order's current data and sends it again (logged in the order's email list). */
  @Post('admin/orders/:id/resend-email')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @RateLimit({ limit: 20, windowMs: MINUTE })
  async resendEmail(@Param('id') id: string, @Body() body: ResendOrderEmailDto) {
    return this.orderMailer.resend(id, body.template);
  }

  /** Status change. PROCESSING / SHIPPED / DELIVERED / CANCELLED / REFUNDED email the customer. */
  @Put('admin/orders/:id/status')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async updateStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateOrderStatusDto) {
    const order = await this.ordersService.updateStatus(id, body.status, body.trackingNumber, { actorEmail: req.user?.email });
    return this.withTransitions(await this.ordersService.findForAdmin(order.id));
  }

  // ─── Refunds (Refund Pending queue) ─────────────

  @Get('admin/refunds')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Header('Cache-Control', 'no-store')
  listRefunds(@Query() query: AdminRefundsQueryDto) {
    return this.refunds.list({
      status: query.status,
      page: Math.max(1, parseInt(query.page ?? '', 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(query.limit ?? '', 10) || 20)),
    });
  }

  /** The admin refunded it in the provider's dashboard and confirms it here: order CANCELLED -> REFUNDED. */
  @Post('admin/refunds/:id/complete')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  completeRefund(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: CompleteRefundDto) {
    return this.refunds.complete(id, { providerRef: body.providerRef || null, note: body.note || null }, req.user?.email ?? null);
  }

  @Post('admin/refunds/:id/fail')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  failRefund(@Param('id') id: string, @Body() body: FailRefundDto) {
    return this.refunds.markFailed(id, body.note);
  }

  /** Admin responses carry the statuses the order may move to next. */
  private withTransitions<T extends { status: OrderStatus; refunds?: { status: RefundStatus }[] }>(order: T) {
    return { ...order, allowedTransitions: this.ordersService.adminTransitions(order) };
  }
}

/** `from`/`to` are inclusive Israel calendar days; the query wants [start of from, start of the day after to). */
function israelDayRange(from?: string, to?: string): { from?: Date; to?: Date } {
  const day = (v: string) => {
    const d = startOfDay(v);
    if (Number.isNaN(d.getTime()) || addDays(v, 0) !== v) throw new BadRequestException('Invalid date');
    return d;
  };
  return { from: from ? day(from) : undefined, to: to ? (day(to), startOfDay(addDays(to, 1))) : undefined };
}
