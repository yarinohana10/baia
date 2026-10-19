import { Injectable } from '@nestjs/common';
import type { OrderConfirmedEvent, OrderNotifier } from './order-notifier';
import { OrderMailer } from './order-mailer';

/**
 * Sends the bilingual order-confirmation email (with a working "view order"
 * link for guests too) and the new-order alert to the store inbox, once
 * payment is confirmed.
 */
@Injectable()
export class EmailOrderNotifier implements OrderNotifier {
  constructor(private readonly mailer: OrderMailer) {}

  async orderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    // Fire-and-forget: a slow mail server must not delay the payment response.
    void this.mailer.orderConfirmed(event.orderId);
  }
}
