import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService, normalizeLocale, type SendResult } from '../email/email.service';
import type { EmailLocale } from '../email/email.types';
import { DeliveryMethod, OrderStatus, type Order, type OrderItem } from '../generated/prisma';
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

export function formatDate(value: Date, locale: EmailLocale): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    dateStyle: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(value);
}

/**
 * Carrier tracking link. Set TRACKING_URL_TEMPLATE (e.g.
 * "https://carrier.example/track?n={tracking}") once a courier is chosen;
 * until then emails show the tracking number only. TRACKING_CARRIER_NAME is
 * the carrier's display name.
 */
export function trackingUrl(trackingNumber: string | null | undefined): string | null {
  const template = process.env.TRACKING_URL_TEMPLATE?.trim();
  if (!template || !trackingNumber) return null;
  return template.replace('{tracking}', encodeURIComponent(trackingNumber));
}

/** Product photos must be absolute for email clients; relative paths are resolved against the API origin. */
export function absoluteImageUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const origin = (process.env.SERVER_URL || process.env.BETTER_AUTH_URL || '').replace(/\/$/, '');
  return u.startsWith('/') && origin ? `${origin}${u}` : null;
}

type ImageRow = { url: string; color: string | null };

/** First photo of the item's colour, else the product's first photo. */
export function itemImage(images: ImageRow[] | undefined, color: string): string | null {
  if (!images?.length) return null;
  const c = color.trim().toLowerCase();
  const match = images.find((i) => i.color?.trim().toLowerCase() === c) ?? images.find((i) => !i.color) ?? images[0];
  return absoluteImageUrl(match.url);
}

type ItemWithImages = OrderItem & { variant?: { product?: { images?: ImageRow[] } | null } | null };
type OrderWithItems = Order & { items: ItemWithImages[] };

export type CancelledEmailOptions = {
  refundAmount?: number | null;
  feeAmount?: number | null;
  refundPending?: boolean;
  note?: string | null;
};

/** Statuses after a successful payment (resending the confirmation makes sense). */
const CONFIRMABLE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/**
 * Builds and sends every order email (customer + store inbox). All sends are
 * fire-and-forget through EmailService.dispatch, which retries, logs to
 * EmailLog (with the orderId) and never throws; the methods themselves
 * swallow lookup errors so callers never fail because of email.
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

  private contactUrl(locale: EmailLocale) {
    return `${clientUrl()}/${locale}/contact`;
  }

  private address(order: Order, locale: EmailLocale): string {
    return this.addressLines(order, locale).join(', ');
  }

  private addressLines(order: Order, locale: EmailLocale): string[] {
    if (order.deliveryMethod === DeliveryMethod.PICKUP_POINT) {
      return [order.pickupPointName, [order.shippingStreet, order.shippingCity].filter(Boolean).join(', ')].filter(
        (x): x is string => !!x,
      );
    }
    const street = [
      `${order.shippingStreet} ${order.shippingNumber}`.trim(),
      order.shippingApartment ? (locale === 'he' ? `דירה ${order.shippingApartment}` : `Apt ${order.shippingApartment}`) : null,
    ]
      .filter(Boolean)
      .join(', ');
    return [order.recipientName, street, [order.shippingCity, order.shippingZip].filter(Boolean).join(' ')].filter(
      (x): x is string => !!x && !!x.trim(),
    );
  }

  private load(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            variant: {
              select: {
                product: { select: { images: { select: { url: true, color: true }, orderBy: { sortOrder: 'asc' } } } },
              },
            },
          },
        },
      },
    });
  }

  private pickupPoint(order: Order) {
    return order.deliveryMethod === DeliveryMethod.PICKUP_POINT && order.pickupPointId
      ? this.prisma.pickupPoint.findUnique({ where: { id: order.pickupPointId } })
      : Promise.resolve(null);
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
      void this.sendConfirmation(order);
      await this.adminNewOrder(order);
    });
  }

  /**
   * Admin "resend confirmation": paid orders only. Awaited, so the admin sees
   * whether it went out (the attempt is logged either way).
   */
  async resendConfirmation(orderId: string): Promise<SendResult> {
    const order = await this.load(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (!order.paidAt || !CONFIRMABLE_STATUSES.includes(order.status)) {
      throw new ConflictException('Only paid orders can get their confirmation resent');
    }
    return this.sendConfirmation(order);
  }

  /** EmailLog rows for an order, newest first (admin order panel). 404 for unknown orders. */
  async emailLogs(orderId: string) {
    const exists = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Order not found');
    return this.prisma.emailLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        template: true,
        to: true,
        subject: true,
        locale: true,
        status: true,
        attempts: true,
        error: true,
        createdAt: true,
      },
    });
  }

  private async sendConfirmation(order: OrderWithItems): Promise<SendResult> {
    const locale = normalizeLocale(order.locale);
    const [config, point] = await Promise.all([
      this.prisma.siteConfig.findUnique({ where: { id: 'default' } }),
      this.pickupPoint(order),
    ]);
    const discount = Number(order.discountAmount);
    const base = clientUrl();

    return this.email.deliver('order-confirmation', {
      to: order.customerEmail,
      locale,
      meta: { orderId: order.id },
      data: {
        name: order.recipientName,
        orderNumber: order.orderNumber,
        orderDate: formatDate(order.paidAt ?? order.createdAt, locale),
        items: order.items.map((i) => ({
          name: (locale === 'he' ? i.productNameHe : null) ?? i.productName,
          color: i.color,
          size: i.size,
          quantity: i.quantity,
          unitPrice: formatMoney(i.unitPrice, locale),
          lineTotal: formatMoney(Number(i.unitPrice) * i.quantity, locale),
          imageUrl: itemImage(i.variant?.product?.images, i.color),
        })),
        subtotal: formatMoney(order.subtotal, locale),
        shipping: Number(order.shippingCost) === 0 ? (locale === 'he' ? 'חינם' : 'Free') : formatMoney(order.shippingCost, locale),
        discount: discount > 0 ? formatMoney(discount, locale) : null,
        total: formatMoney(order.total, locale),
        address: this.address(order, locale),
        addressLines: this.addressLines(order, locale),
        pickupHours: point?.hours ?? null,
        orderUrl: this.orderUrl(order, locale),
        deliveryMethod: order.deliveryMethod,
        etaDays: etaFor(order.deliveryMethod, deliveryConfig(config)),
        trackUrl: `${base}/${locale}/order-status`,
        cancelUrl: `${base}/${locale}/cancel-order`,
        cancelWindowHours: config?.selfCancelWindowHours ?? DEFAULT_SELF_CANCEL_WINDOW_HOURS,
        contactUrl: this.contactUrl(locale),
        payment: {
          method: order.paymentMethod,
          cardBrand: order.cardBrand,
          cardLast4: order.cardLast4,
          installments: order.paymentInstallments,
        },
      },
    });
  }

  private async adminNewOrder(order: OrderWithItems) {
    const to = await this.adminInbox();
    if (!to) return;
    void this.email.dispatch('admin-new-order', {
      to,
      locale: 'he',
      meta: { orderId: order.id },
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
      const [config, point] = await Promise.all([
        this.prisma.siteConfig.findUnique({ where: { id: 'default' } }),
        this.pickupPoint(order),
      ]);
      void this.email.dispatch('order-shipped', {
        to: order.customerEmail,
        locale,
        meta: { orderId: order.id },
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
          carrierName: process.env.TRACKING_CARRIER_NAME?.trim() || null,
          etaDays: etaFor(order.deliveryMethod, deliveryConfig(config)),
          orderUrl: this.orderUrl(order, locale),
          contactUrl: this.contactUrl(locale),
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
        meta: { orderId: order.id },
        data: {
          name: order.recipientName,
          orderNumber: order.orderNumber,
          orderUrl: this.orderUrl(order, locale),
          returnsUrl: `${clientUrl()}/${locale}/returns`,
          contactUrl: this.contactUrl(locale),
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
        meta: { orderId: order.id },
        data: {
          name: order.recipientName,
          orderNumber: order.orderNumber,
          paid,
          refundAmount: opts.refundAmount ? formatMoney(opts.refundAmount, locale) : null,
          feeAmount: opts.feeAmount ? formatMoney(opts.feeAmount, locale) : null,
          orderTotal: formatMoney(order.total, locale),
          refundPending: opts.refundPending ?? false,
          note: opts.note ?? null,
          shopUrl: `${clientUrl()}/${locale}`,
          contactUrl: this.contactUrl(locale),
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
        meta: { orderId: order.id },
        data: {
          name: order.recipientName,
          orderNumber: order.orderNumber,
          requiresReturn,
          orderUrl: this.orderUrl(order, locale),
          contactUrl: this.contactUrl(locale),
        },
      });
      const to = await this.adminInbox();
      if (!to) return;
      void this.email.dispatch('admin-cancellation-request', {
        to,
        locale: 'he',
        meta: { orderId: order.id },
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
        meta: { orderId: request.orderId },
        data: {
          name: request.order.recipientName,
          orderNumber: request.order.orderNumber,
          note: request.adminNote,
          contactUrl: this.contactUrl(locale),
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
        meta: { orderId: order.id },
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
