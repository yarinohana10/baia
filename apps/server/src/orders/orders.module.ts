import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { ORDER_NOTIFIER } from './order-notifier';
import { EmailOrderNotifier } from './email-order-notifier';
import { PendingOrderSweeper } from './pending-order-sweeper';

@Module({
  imports: [AuthModule, CouponsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PendingOrderSweeper,
    RateLimitGuard,
    { provide: ORDER_NOTIFIER, useClass: EmailOrderNotifier },
  ],
  exports: [OrdersService, ORDER_NOTIFIER],
})
export class OrdersModule {}
