import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { AuthGuard, Roles } from '../auth/auth.guard';

@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Public: validate a coupon code during checkout
  @Post('coupons/validate')
  validate(@Body() body: { code: string; cartTotal: number }) {
    return this.couponsService.validate(body.code, body.cartTotal);
  }

  // ─── Admin ──────────────────────────────────────

  @Get('admin/coupons')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findAll() {
    return this.couponsService.findAll();
  }

  @Get('admin/coupons/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  findById(@Param('id') id: string) {
    return this.couponsService.findById(id);
  }

  @Post('admin/coupons')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  create(
    @Body()
    body: {
      code: string;
      discountType: 'PERCENTAGE' | 'FIXED';
      value: number;
      minCartValue?: number;
      maxUses?: number;
      expiresAt?: string;
    },
  ) {
    return this.couponsService.create(body);
  }

  @Put('admin/coupons/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.couponsService.update(id, body);
  }

  @Delete('admin/coupons/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
