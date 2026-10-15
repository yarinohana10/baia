import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CartService } from './cart.service';
import { AuthGuard } from '../auth/auth.guard';
import { getOptionalUser } from '../common/session';
import { strictValidationPipe } from '../common/validation';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import {
  type CartOwner,
  clearGuestCartCookie,
  issueGuestCartKey,
  readGuestCartKeyHash,
} from './cart-identity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
@UseGuards(RateLimitGuard)
@UsePipes(strictValidationPipe)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /** Session user, else existing guest cookie, else null. */
  private async resolveOwner(req: Request): Promise<CartOwner | null> {
    const user = await getOptionalUser(req);
    if (user) return { userId: user.id };
    const guestKeyHash = readGuestCartKeyHash(req);
    return guestKeyHash ? { guestKeyHash } : null;
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async getCart(@Req() req: Request) {
    return this.cartService.getCart(await this.resolveOwner(req));
  }

  @Post('items')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  @Header('Cache-Control', 'no-store')
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: AddCartItemDto,
  ) {
    // First add for a new guest mints the httpOnly cart cookie.
    const owner = (await this.resolveOwner(req)) ?? { guestKeyHash: issueGuestCartKey(res) };
    return this.cartService.addItem(owner, body.variantId, body.quantity);
  }

  @Put('items/:id')
  @Header('Cache-Control', 'no-store')
  async updateItem(@Req() req: Request, @Param('id') itemId: string, @Body() body: UpdateCartItemDto) {
    return this.cartService.updateItemQuantity(await this.resolveOwner(req), itemId, body.quantity);
  }

  @Delete('items/:id')
  @Header('Cache-Control', 'no-store')
  async removeItem(@Req() req: Request, @Param('id') itemId: string) {
    return this.cartService.removeItem(await this.resolveOwner(req), itemId);
  }

  /**
   * Called by the client right after sign-in. The guest cart is identified
   * only by the caller's own httpOnly cookie (never by a body parameter), so a
   * user cannot pull someone else's guest cart into their account.
   */
  @Post('merge')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Header('Cache-Control', 'no-store')
  async mergeCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const guestKeyHash = readGuestCartKeyHash(req);
    const report = guestKeyHash
      ? await this.cartService.mergeGuestCart(guestKeyHash, userId)
      : { merged: 0, adjusted: [], dropped: [] };
    if (guestKeyHash) clearGuestCartCookie(res);
    return { ...report, cart: await this.cartService.getCart({ userId }) };
  }
}
