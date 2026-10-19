import { Injectable } from '@nestjs/common';
import { PaymentChargeParams, PaymentProvider, PaymentResult } from './payment.interface';
import { randomUUID } from 'crypto';

const delay = (envMs: string | undefined, fallback: number) =>
  new Promise((r) => setTimeout(r, Number(envMs ?? fallback)));

/**
 * Development-only provider: moves no money. Never bound in production
 * unless PAYMENT_PROVIDER=mock is set explicitly (see payment-provider.factory.ts).
 *
 * Emulates an Israeli PSP's outcomes for the storefront's test cards via
 * `simulation` (only forwarded by PaymentService outside production):
 *  - success / 3ds (challenge already passed on the hosted page) -> approved
 *  - decline            -> card_declined
 *  - insufficient_funds -> insufficient_funds
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly testMode = true;

  async charge(params: PaymentChargeParams): Promise<PaymentResult> {
    await delay(process.env.MOCK_PAYMENT_DELAY_MS, 500);

    if (params.simulation === 'decline') {
      return { success: false, transactionId: `mock_${randomUUID()}`, error: 'card_declined', errorCode: 'card_declined' };
    }
    if (params.simulation === 'insufficient_funds') {
      return {
        success: false,
        transactionId: `mock_${randomUUID()}`,
        error: 'insufficient_funds',
        errorCode: 'insufficient_funds',
      };
    }

    return {
      success: true,
      transactionId: `mock_${randomUUID()}`,
    };
  }

  async refund(transactionId: string, _amount?: number): Promise<PaymentResult> {
    await delay(process.env.MOCK_PAYMENT_DELAY_MS, 300);

    return {
      success: true,
      transactionId: `refund_${transactionId}`,
    };
  }
}
