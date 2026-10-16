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
import { AdminOrdersQueryDto, CreateOrderDto, OrderAccessDto, UpdateOrderStatusDto } from './dto/order.dto';
import { allowedTransitions } from './order-status';
import type { OrderStatus } from '../generated/prisma';
import {
  ORDER_ACCESS_COOKIE_MAX_AGE_MS,
  extractOrderToken,
  orderAccessCookieName,
} from './order-access';

const MINUTE = 60_000;

@Controller()
@UseGuards(RateLimitGuard)
@UsePipes(strictValidationPipe)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
      shippingCity: body.shippingCity,
      shippingStreet: body.shippingStreet,
      shippingNumber: body.shippingNumber,
      shippingApartment: body.shippingApartment,
      shippingZip: body.shippingZip,
    });

    // accessToken is returned exactly once and only for guest orders.
    return accessToken ? { ...order, accessToken } : order;
  }

  // Customer: my orders (bound to the session user only)
  @Get('orders/my')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  async myOrders(@Req() req: Request) {
    return this.ordersService.findByUser((req as Request & { user: { id: string } }).user.id);
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

    if (access.accessTokenExpiresAt) {
      const remaining = access.accessTokenExpiresAt.getTime() - Date.now();
      res.cookie(
        orderAccessCookieName(id),
        body.token,
        secureCookieOptions({
          path: `/v1/orders/${encodeURIComponent(id)}`,
          maxAge: Math.max(0, Math.min(ORDER_ACCESS_COOKIE_MAX_AGE_MS, remaining)),
        }),
      );
    }
    return this.ordersService.findById(id);
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

  @Get('admin/orders/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async findById(@Param('id') id: string) {
    return withTransitions(await this.ordersService.findById(id));
  }

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
