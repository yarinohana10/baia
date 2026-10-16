import { Injectable } from '@nestjs/common';
import { PaymentProvider, PaymentResult } from './payment.interface';
import { randomUUID } from 'crypto';

/**
 * Development-only provider: always succeeds, moves no money.
 * Never bound in production unless PAYMENT_PROVIDER=mock is set explicitly
 * (see payment-provider.factory.ts).
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async charge(_params: {
    amount: number;
    currency: string;
    orderId: string;
    customerEmail: string;
    idempotencyKey: string;
  }): Promise<PaymentResult> {
    // Simulate payment processing delay
    await new Promise((r) => setTimeout(r, Number(process.env.MOCK_PAYMENT_DELAY_MS ?? 500)));

    return {
      success: true,
      transactionId: `mock_${randomUUID()}`,
    };
  }

  async refund(transactionId: string, _amount?: number): Promise<PaymentResult> {
    await new Promise((r) => setTimeout(r, Number(process.env.MOCK_PAYMENT_DELAY_MS ?? 300)));

    return {
      success: true,
      transactionId: `refund_${transactionId}`,
    };
  }
}
