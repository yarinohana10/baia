import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { Request } from 'express';
import { auth } from '../auth/auth';
import { fromNodeHeaders } from 'better-auth/node';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private async getIdentifiers(req: Request) {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (session?.user) return { userId: session.user.id, sessionId: undefined };
    } catch {}
    const sessionId = (req.headers['x-guest-session'] as string) || undefined;
    return { userId: undefined, sessionId };
  }

  @Get()
  async getCart(@Req() req: Request) {
    const { userId, sessionId } = await this.getIdentifiers(req);
    return this.cartService.getCart(userId, sessionId);
  }

  @Post('items')
  async addItem(
    @Req() req: Request,
    @Body() body: { variantId: string; quantity: number },
  ) {
    const { userId, sessionId } = await this.getIdentifiers(req);
    return this.cartService.addItem(userId, sessionId, body.variantId, body.quantity);
  }

  @Put('items/:id')
  async updateItem(
    @Req() req: Request,
    @Param('id') itemId: string,
    @Body() body: { quantity: number },
  ) {
    const { userId, sessionId } = await this.getIdentifiers(req);
    return this.cartService.updateItemQuantity(userId, sessionId, itemId, body.quantity);
  }

  @Delete('items/:id')
  async removeItem(@Req() req: Request, @Param('id') itemId: string) {
    const { userId, sessionId } = await this.getIdentifiers(req);
    return this.cartService.removeItem(userId, sessionId, itemId);
  }

  @Post('merge')
  async mergeCart(@Req() req: Request, @Body() body: { sessionId: string }) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session?.user) {
      await this.cartService.mergeGuestCart(body.sessionId, session.user.id);
    }
    return { merged: true };
  }
}
