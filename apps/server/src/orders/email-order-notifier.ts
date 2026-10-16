import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService, normalizeLocale } from '../email/email.service';
import type { OrderConfirmedEvent, OrderNotifier } from './order-notifier';

const money = (value: { toString(): string } | number, locale: 'he' | 'en') =>
  new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency: 'ILS' }).format(
    Number(value.toString()),
  );

/** Sends the bilingual order-confirmation email once payment is confirmed. */
@Injectable()
export class EmailOrderNotifier implements OrderNotifier {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async orderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: event.orderId }, include: { items: true } });
    if (!order) return;
    const locale = normalizeLocale(order.locale);
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
    const discount = Number(order.discountAmount);
    const address = [
      order.recipientName,
      `${order.shippingStreet} ${order.shippingNumber}`,
      order.shippingApartment ? (locale === 'he' ? `דירה ${order.shippingApartment}` : `Apt ${order.shippingApartment}`) : null,
      order.shippingCity,
      order.shippingZip,
    ]
      .filter(Boolean)
      .join(', ');

    // Fire-and-forget: a slow mail server must not delay the payment response.
    void this.email.dispatch('order-confirmation', {
      to: order.customerEmail,
      locale,
      data: {
        orderNumber: order.orderNumber,
        items: order.items.map((i) => ({
          name: (locale === 'he' ? i.productNameHe : null) ?? i.productName,
          color: i.color,
          size: i.size,
          quantity: i.quantity,
          lineTotal: money(Number(i.unitPrice) * i.quantity, locale),
        })),
        subtotal: money(order.subtotal, locale),
        shipping: Number(order.shippingCost) === 0 ? (locale === 'he' ? 'חינם' : 'Free') : money(order.shippingCost, locale),
        discount: discount > 0 ? money(discount, locale) : null,
        total: money(order.total, locale),
        address,
        // Guests' access tokens are never stored, so only account holders get a link.
        orderUrl: order.userId ? `${clientUrl}/${locale}/account/orders` : null,
      },
    });
  }
}
