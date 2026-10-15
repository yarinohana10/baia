import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';

@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [CartService, RateLimitGuard],
  exports: [CartService],
})
export class CartModule {}
