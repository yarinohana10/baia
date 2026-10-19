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
  CreateOrderDto,
  OrderAccessDto,
  OrderLookupDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { allowedTransitions } from './order-status';
import { OrderMailer } from './order-mailer';
import type { OrderStatus } from '../generated/prisma';
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
  ) {}

  @Post('orders')
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
    const parse = (v: string | undefined, endOfDay: boolean) => {
      if (!v) return undefined;
      const d = new Date(v.length === 10 ? `${v}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : v);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
      return d;
    };
    const csv = await this.ordersService.exportCsv({
      from: parse(query.from, false),
      to: parse(query.to, true),
      status: query.status,
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
    return withTransitions(await this.ordersService.findForAdmin(id));
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

  /** Status change. SHIPPED / DELIVERED / CANCELLED / REFUNDED email the customer. */
  @Put('admin/orders/:id/status')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateOrderStatusDto) {
    return withTransitions(await this.ordersService.updateStatus(id, body.status, body.trackingNumber));
  }
}

/** Admin responses carry the statuses the order may move to next. */
function withTransitions<T extends { status: OrderStatus }>(order: T) {
  return { ...order, allowedTransitions: allowedTransitions(order.status) };
}
