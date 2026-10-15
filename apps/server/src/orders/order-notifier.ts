import { Injectable, Logger } from '@nestjs/common';

/**
 * Hook for order-confirmation emails (OUT OF SCOPE for this PR).
 *
 * The email service should implement OrderNotifier and be bound to the
 * ORDER_NOTIFIER token in OrdersModule, replacing NoopOrderNotifier:
 *
 *   { provide: ORDER_NOTIFIER, useClass: EmailOrderNotifier }
 *
 * Contract:
 *  - Called after the payment is confirmed (status -> CONFIRMED). Must not
 *    throw into the payment flow; failures are caught and logged by callers.
 *  - For guest orders `guestAccessLink` is NOT provided here, because the
 *    raw access token is never persisted. If emails should contain a
 *    "view your order" link, mint a fresh token at send time with
 *    OrdersService.issueGuestAccessToken(orderId) (rotates the stored hash)
 *    and build `${CLIENT_URL}/${locale}/order-confirmation/${id}#token=${token}`.
 *    Keep the token in the fragment, never in the query string.
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
