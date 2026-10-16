import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { NoopOrderNotifier, ORDER_NOTIFIER } from './order-notifier';

@Module({
  imports: [AuthModule, CouponsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    RateLimitGuard,
    // Replace with the email-backed notifier once the email service lands.
    { provide: ORDER_NOTIFIER, useClass: NoopOrderNotifier },
  ],
  exports: [OrdersService, ORDER_NOTIFIER],
})
export class OrdersModule {}
