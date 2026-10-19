import { Injectable, Logger } from '@nestjs/common';

/**
 * Hook called when an order is paid. Bound to EmailOrderNotifier in
 * OrdersModule (`{ provide: ORDER_NOTIFIER, useClass: EmailOrderNotifier }`).
 *
 * Contract:
 *  - Called after the payment is confirmed (status -> CONFIRMED). Must not
 *    throw into the payment flow; failures are caught and logged by callers.
 *  - Guest links are built by OrderMailer with a *signed* access token
 *    (order-access.ts → signOrderToken): minting one does not rotate the
 *    stored hash, so the shopper's open confirmation page keeps working.
 *    The token goes in the URL fragment, never the query string.
 */
export interface OrderNotifier {
  orderConfirmed(event: OrderConfirmedEvent): Promise<void>;
}

export type OrderConfirmedEvent = {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  userId: string | null;
  total: string;
  currency: string;
};

export const ORDER_NOTIFIER = 'ORDER_NOTIFIER';

@Injectable()
export class NoopOrderNotifier implements OrderNotifier {
  private readonly logger = new Logger('OrderNotifier');

  async orderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    // Never log the email address or tokens.
    this.logger.debug(`order ${event.orderNumber} confirmed (no notifier bound)`);
  }
}
