import { Global, Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment.interface';
import { OrderPaymentController, PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { createPaymentProvider } from './payment-provider.factory';
import { PAYMENT_WEBHOOK_VERIFIER, createWebhookVerifier } from './webhook/webhook-verifier';
import { OrdersModule } from '../orders/orders.module';
import { RateLimitGuard } from '../common/rate-limit.guard';

@Global()
@Module({
  imports: [OrdersModule],
  controllers: [PaymentController, OrderPaymentController],
  providers: [
    PaymentService,
    RateLimitGuard,
    {
      // Fails closed: throws at boot in production unless a provider is
      // explicitly configured (see payment-provider.factory.ts).
      provide: PAYMENT_PROVIDER,
      useFactory: () => createPaymentProvider(),
    },
    {
      provide: PAYMENT_WEBHOOK_VERIFIER,
      useFactory: () => createWebhookVerifier(),
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
