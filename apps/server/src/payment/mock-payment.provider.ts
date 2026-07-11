import { Injectable } from '@nestjs/common';
import { PaymentProvider, PaymentResult } from './payment.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async charge(params: {
    amount: number;
    currency: string;
    orderId: string;
    customerEmail: string;
  }): Promise<PaymentResult> {
    // Simulate payment processing delay
    await new Promise((r) => setTimeout(r, 500));

    return {
      success: true,
      transactionId: `mock_${randomUUID().slice(0, 8)}`,
    };
  }

  async refund(transactionId: string, _amount?: number): Promise<PaymentResult> {
    await new Promise((r) => setTimeout(r, 300));

    return {
      success: true,
      transactionId: `refund_${transactionId}`,
    };
  }
}
