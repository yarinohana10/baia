import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

@Controller('wishlist')
@UseGuards(AuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(@Req() req: Request) {
    return this.wishlistService.getWishlist((req as any).user.id);
  }

  @Post(':productId')
  addToWishlist(@Req() req: Request, @Param('productId') productId: string) {
    return this.wishlistService.addToWishlist((req as any).user.id, productId);
  }

  @Delete(':productId')
  removeFromWishlist(@Req() req: Request, @Param('productId') productId: string) {
    return this.wishlistService.removeFromWishlist((req as any).user.id, productId);
  }

  @Get(':productId/check')
  isInWishlist(@Req() req: Request, @Param('productId') productId: string) {
    return this.wishlistService.isInWishlist((req as any).user.id, productId);
  }
}
