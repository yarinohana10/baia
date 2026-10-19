import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService, normalizeLocale } from '../email/email.service';
import type { EmailLocale } from '../email/email.types';
import { DeliveryMethod, type Order, type OrderItem } from '../generated/prisma';
import { signOrderToken } from './order-access';
import { deliveryConfig, etaFor } from './delivery';
import { DEFAULT_SELF_CANCEL_WINDOW_HOURS, REASON_LABELS_HE } from './cancellation-eligibility';

export function clientUrl(): string {
  return (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
}

export function formatMoney(value: { toString(): string } | number, locale: EmailLocale): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency: 'ILS' }).format(
    Number(value.toString()),
  );
}

/**
 * Carrier tracking link. Set TRACKING_URL_TEMPLATE (e.g.
 * "https://carrier.example/track?n={tracking}") once a courier is chosen;
 * until then emails show the tracking number only.
 */
export function trackingUrl(trackingNumber: string | null | undefined): string | null {
  const template = process.env.TRACKING_URL_TEMPLATE?.trim();
  if (!template || !trackingNumber) return null;
  return template.replace('{tracking}', encodeURIComponent(trackingNumber));
}

type OrderWithItems = Order & { items: OrderItem[] };

export type CancelledEmailOptions = {
  refundAmount?: number | null;
  feeAmount?: number | null;
  refundPending?: boolean;
  note?: string | null;
};

/**
 * Builds and sends every order email (customer + store inbox). All sends are
 * fire-and-forget through EmailService.dispatch, which never throws; the
 * methods themselves swallow lookup errors so callers never fail because of
 * email.
 */
@Injectable()
export class OrderMailer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Store inbox: SiteConfig.contactEmail, else ADMIN_NOTIFY_EMAIL. */
  async adminInbox(): Promise<string | null> {
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' }, select: { contactEmail: true } });
    return config?.contactEmail?.trim() || process.env.ADMIN_NOTIFY_EMAIL?.trim() || null;
  }

  /** Account page for members; a signed, non-rotating guest link otherwise (token in the fragment). */
  orderUrl(order: Pick<Order, 'id' | 'userId'>, locale: EmailLocale): string {
    if (order.userId) return `${clientUrl()}/${locale}/account/orders`;
    return `${clientUrl()}/${locale}/order-confirmation/${order.id}#token=${signOrderToken(order.id)}`;
  }

  private adminOrderUrl(order: Pick<Order, 'orderNumber'>) {
    return `${clientUrl()}/he/admin/orders?q=${encodeURIComponent(order.orderNumber)}`;
  }

  private address(order: Order, locale: EmailLocale): string {
    if (order.deliveryMethod === DeliveryMethod.PICKUP_POINT) {
      return [order.pickupPointName, order.shippingStreet, order.shippingCity].filter(Boolean).join(', ');
    }
    return [
      order.recipientName,
      `${order.shippingStreet} ${order.shippingNumber}`.trim(),
      order.shippingApartment ? (locale === 'he' ? `דירה ${order.shippingApartment}` : `Apt ${order.shippingApartment}`) : null,
      order.shippingCity,
      order.shippingZip,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private load(orderId: string) {
    return this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  }

  private async safely(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      console.error(`[email] order email failed: ${(err as Error)?.message}`);
    }
  }

  /** Customer confirmation + store alert, after payment. */
  orderConfirmed(orderId: string): Promise<void> {
    return this.safely(async () => {
      const order = await this.load(orderId);
      if (!order) return;
      const locale = normalizeLocale(order.locale);
      const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
      const delivery = deliveryConfig(config);
      const discount = Number(order.discountAmount);
      const base = clientUrl();

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
            lineTotal: formatMoney(Number(i.unitPrice) * i.quantity, locale),
          })),
          subtotal: formatMoney(order.subtotal, locale),
          shipping: Number(order.shippingCost) === 0 ? (locale === 'he' ? 'חינם' : 'Free') : formatMoney(order.shippingCost, locale),
          discount: discount > 0 ? formatMoney(discount, locale) : null,
          total: formatMoney(order.total, locale),
          address: this.address(order, locale),
          orderUrl: this.orderUrl(order, locale),
          deliveryMethod: order.deliveryMethod,
          etaDays: etaFor(order.deliveryMethod, delivery),
          trackUrl: `${base}/${locale}/order-status`,
          cancelUrl: `${base}/${locale}/cancel-order`,
          cancelWindowHours: config?.selfCancelWindowHours ?? DEFAULT_SELF_CANCEL_WINDOW_HOURS,
        },
      });

      await this.adminNewOrder(order);
    });
  }

  private async adminNewOrder(order: OrderWithItems) {
    const to = await this.adminInbox();
    if (!to) return;
    void this.email.dispatch('admin-new-order', {
      to,
      locale: 'he',
      data: {
        orderNumber: order.orderNumber,
        customer: order.recipientName ?? order.customerEmail,
        email: order.customerEmail,
        phone: order.phone,
        total: formatMoney(order.total, 'he'),
        itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
        delivery:
          order.deliveryMethod === DeliveryMethod.PICKUP_POINT
            ? `איסוף מנקודת חלוקה - ${this.address(order, 'he')}`
            : `שליח עד הבית - ${this.address(order, 'he')}`,
        marketingConsent: order.marketingConsent,
        adminUrl: this.adminOrderUrl(order),
      },
    });
  }

  orderShipped(orderId: string): Promise<void> {
    return this.safely(async () => {
      const order = await this.load(orderId);
      if (!order) return;
      const locale = normalizeLocale(order.locale);
      const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
      const point =
        order.deliveryMethod === DeliveryMethod.PICKUP_POINT && order.pickupPointId
          ? await this.prisma.pickupPoint.findUnique({ where: { id: order.pickupPointId } })
          : null;
      void this.email.dispatch('order-shipped', {
        to: order.customerEmail,
        locale,
        data: {
          name: order.recipientName,
          orderNumber: order.orderNumber,
          deliveryMethod: order.deliveryMethod,
          pickupPoint:
            order.deliveryMethod === DeliveryMethod.PICKUP_POINT
              ? {
                  name: order.pickupPointName ?? point?.name ?? '',
                  address: order.shippingStreet,
                  city: order.shippingCity,
                  hours: point?.hours ?? null,
                }
              : null,
          address: order.deliveryMethod === DeliveryMethod.COURIER ? this.address(order, locale) : null,
          trackingNumber: order.trackingNumber,
          trackingUrl: trackingUrl(order.trackingNumber),
          etaDays: etaFor(order.deliveryMethod, deliveryConfig(config)),
          orderUrl: this.orderUrl(order, locale),
        },
      });
    });
  }

  orderDelivered(orderId: string): Promise<void> {
    return this.safely(async () => {
      const order = await this.load(orderId);
      if (!order) return;
      const locale = normalizeLocale(order.locale);
      void this.email.dispatch('order-delivered', {
        to: order.customerEmail,
        locale,
        data: {
          name: order.recipientName,
          orderNumber: order.orderNumber,
          orderUrl: this.orderUrl(order, locale),
          returnsUrl: `${clientUrl()}/${locale}/returns`,
        },
      });
    });
  }

  /** `paid` = money had been taken before the cancellation. */
  orderCancelled(orderId: string, paid: boolean, opts: CancelledEmailOptions = {}): Promise<void> {
    return this.safely(async () => {
      const order = await this.load(orderId);
      if (!order) return;
      const locale = normalizeLocale(order.locale);
      void this.email.dispatch('order-cancelled', {
        to: order.customerEmail,
        locale,
        data: {
          name: order.recipientName,
          orderNumber: order.orderNumber,
          paid,
          refundAmount: opts.refundAmount ? formatMoney(opts.refundAmount, locale) : null,
          feeAmount: opts.feeAmount ? formatMoney(opts.feeAmount, locale) : null,
          refundPending: opts.refundPending ?? false,
          note: opts.note ?? null,
          shopUrl: `${clientUrl()}/${locale}`,
        },
      });
    });
  }

  cancellationRequested(requestId: string, insideWindow: boolean, requiresReturn: boolean): Promise<void> {
    return this.safely(async () => {
      const request = await this.prisma.cancellationRequest.findUnique({
        where: { id: requestId },
        include: { order: true },
      });
      if (!request) return;
      const { order } = request;
      const locale = normalizeLocale(order.locale);
      void this.email.dispatch('cancellation-request-received', {
        to: order.customerEmail,
        locale,
        data: {
          name: order.recipientName,
          orderNumber: order.orderNumber,
          requiresReturn,
          orderUrl: this.orderUrl(order, locale),
        },
      });
      const to = await this.adminInbox();
      if (!to) return;
      void this.email.dispatch('admin-cancellation-request', {
        to,
        locale: 'he',
        data: {
          orderNumber: order.orderNumber,
          customer: order.recipientName ?? order.customerEmail,
          email: order.customerEmail,
          phone: request.contactPhone ?? order.phone,
          total: formatMoney(order.total, 'he'),
          reason: REASON_LABELS_HE[request.reason] ?? request.reason,
          details: request.details,
          insideWindow,
          requiresReturn,
          adminUrl: `${clientUrl()}/he/admin/cancellations`,
        },
      });
    });
  }

  cancellationRejected(requestId: string): Promise<void> {
    return this.safely(async () => {
      const request = await this.prisma.cancellationRequest.findUnique({
        where: { id: requestId },
        include: { order: true },
      });
      if (!request) return;
      const locale = normalizeLocale(request.order.locale);
      void this.email.dispatch('cancellation-request-rejected', {
        to: request.order.customerEmail,
        locale,
        data: {
          name: request.order.recipientName,
          orderNumber: request.order.orderNumber,
          note: request.adminNote,
          contactUrl: `${clientUrl()}/${locale}/contact`,
        },
      });
    });
  }

  adminSelfCancelled(
    orderId: string,
    info: { reason: string; details?: string | null; refundAmount: number | null; refundFailed: boolean },
  ): Promise<void> {
    return this.safely(async () => {
      const order = await this.load(orderId);
      const to = await this.adminInbox();
      if (!order || !to) return;
      void this.email.dispatch('admin-order-self-cancelled', {
        to,
        locale: 'he',
        data: {
          orderNumber: order.orderNumber,
          customer: order.recipientName ?? order.customerEmail,
          email: order.customerEmail,
          total: formatMoney(order.total, 'he'),
          refundAmount: info.refundAmount ? formatMoney(info.refundAmount, 'he') : null,
          refundFailed: info.refundFailed,
          reason: REASON_LABELS_HE[info.reason] ?? info.reason,
          details: info.details,
          adminUrl: this.adminOrderUrl(order),
        },
      });
    });
  }
}
