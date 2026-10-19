import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { CancellationsController } from './cancellations.controller';
import { CancellationsService } from './cancellations.service';

/** PAYMENT_PROVIDER comes from the global PaymentModule. */
@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [CancellationsController],
  providers: [CancellationsService, RateLimitGuard],
})
export class CancellationsModule {}
