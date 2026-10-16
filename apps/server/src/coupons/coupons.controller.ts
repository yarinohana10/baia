import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { strictValidationPipe } from '../common/validation';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';

const MINUTE = 60_000;

@Controller()
@UsePipes(strictValidationPipe)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Public: validate a coupon code during checkout. Rate limited so codes
  // cannot be brute-forced.
  @Post('coupons/validate')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: MINUTE })
  validate(@Body() body: ValidateCouponDto) {
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
  create(@Body() body: CreateCouponDto) {
    return this.couponsService.create(body);
  }

  @Put('admin/coupons/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: UpdateCouponDto) {
    return this.couponsService.update(id, body);
  }

  /** Returns `{ deleted: true }`, or `{ deleted: false, deactivated: true }` when orders use the coupon. */
  @Delete('admin/coupons/:id')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  delete(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
