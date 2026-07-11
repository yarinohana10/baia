import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { Request } from 'express';
import { auth } from '../auth/auth';
import { fromNodeHeaders } from 'better-auth/node';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  async createOrder(@Req() req: Request, @Body() body: any) {
    let userId: string | undefined;
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (session?.user) userId = session.user.id;
    } catch {}

    return this.ordersService.createOrder({
      userId,
      customerEmail: body.customerEmail,
      couponCode: body.couponCode,
      shippingCity: body.shippingCity,
      shippingStreet: body.shippingStreet,
      shippingNumber: body.shippingNumber,
      shippingApartment: body.shippingApartment,
      shippingZip: body.shippingZip,
      cartId: body.cartId,
    });
  }

  // Customer: my orders
  @Get('orders/my')
  @UseGuards(AuthGuard)
  async myOrders(@Req() req: Request) {
    return this.ordersService.findByUser((req as any).user.id);
  }

  @Get('orders/:id')
  @UseGuards(AuthGuard)
  async getOrder(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  // ─── Admin ──────────────────────────────────────

  @Get('admin/orders')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findAll({
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('admin/orders/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Put('admin/orders/:id/status')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; trackingNumber?: string },
  ) {
    return this.ordersService.updateStatus(id, body.status, body.trackingNumber);
  }
}
