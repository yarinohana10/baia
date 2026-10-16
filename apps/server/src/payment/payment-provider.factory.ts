import { Logger } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';
import type { PaymentProvider } from './payment.interface';

type Env = Record<string, string | undefined>;

/**
 * Selects the payment provider from PAYMENT_PROVIDER.
 *
 *  - unset + NODE_ENV !== production -> mock (dev convenience)
 *  - unset + NODE_ENV === production -> refuse to boot (fail closed: a
 *    production deploy must never silently accept free "payments")
 *  - "mock"                          -> mock, with a loud warning in prod
 *  - anything else                   -> refuse to boot until a real provider
 *                                       is implemented and registered here
 *
 * To add a real provider: implement PaymentProvider (and a WebhookVerifier,
 * see webhook/), add a case below, and set PAYMENT_PROVIDER=<name>.
 */
export function createPaymentProvider(env: Env = process.env, logger = new Logger('PaymentProvider')): PaymentProvider {
  const configured = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  const isProduction = env.NODE_ENV === 'production';

  if (!configured) {
    if (isProduction) {
      throw new Error(
        'PAYMENT_PROVIDER is not set. Refusing to bind the mock payment provider in production. ' +
          'Configure a real provider, or set PAYMENT_PROVIDER=mock explicitly for a staging/demo deploy.',
      );
    }
    return new MockPaymentProvider();
  }

  switch (configured) {
    case 'mock':
      if (isProduction) {
        logger.warn('PAYMENT_PROVIDER=mock in production: orders will be confirmed WITHOUT charging customers.');
      }
      return new MockPaymentProvider();
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${configured}". No provider is registered under that name.`);
  }
}
