import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Delete,
  Param,
  UseGuards,
  UsePipes,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { WishlistService } from './wishlist.service';
import { AuthGuard } from '../auth/auth.guard';
import { strictValidationPipe } from '../common/validation';
import { MergeWishlistDto } from './dto/wishlist.dto';

type AuthedRequest = Request & { user: { id: string } };

@Controller('wishlist')
@UseGuards(AuthGuard)
@UsePipes(strictValidationPipe)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getWishlist(@Req() req: AuthedRequest) {
    return this.wishlistService.getWishlist(req.user.id);
  }

  // Declared before ':productId' so "merge" is not captured as a product id.
  @Post('merge')
  @HttpCode(200)
  merge(@Req() req: AuthedRequest, @Body() body: MergeWishlistDto) {
    return this.wishlistService.merge(req.user.id, body.productIds);
  }

  @Post(':productId')
  addToWishlist(@Req() req: AuthedRequest, @Param('productId') productId: string) {
    return this.wishlistService.addToWishlist(req.user.id, productId);
  }

  @Delete(':productId')
  removeFromWishlist(@Req() req: AuthedRequest, @Param('productId') productId: string) {
    return this.wishlistService.removeFromWishlist(req.user.id, productId);
  }

  @Get(':productId/check')
  isInWishlist(@Req() req: AuthedRequest, @Param('productId') productId: string) {
    return this.wishlistService.isInWishlist(req.user.id, productId);
  }
}
