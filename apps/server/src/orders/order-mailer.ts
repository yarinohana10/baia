import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService, normalizeLocale, type SendResult } from '../email/email.service';
import type { EmailLocale } from '../email/email.types';
import { CancellationStatus, DeliveryMethod, OrderStatus, RefundStatus, type Order, type OrderItem } from '../generated/prisma';
import { signOrderToken } from './order-access';
import { deliveryConfig, etaFor } from './delivery';
import { REASON_LABELS_HE } from './cancellation-eligibility';
import type { ResendableEmail } from './dto/order.dto';
import { ITEM_IMAGES_SELECT, itemImage, type ImageRow } from './order-views';

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

type ItemWithImages = OrderItem & { variant?: { product?: { images?: ImageRow[] } | null } | null };
type OrderWithItems = Order & { items: ItemWithImages[] };

export type CancelledEmailOptions = {
  /** Who triggered it; shown to the business in the alert. Defaults to the store itself. */
  cancelledBy?: 'customer' | 'admin' | 'request';
  refundAmount?: number | null;
  feeAmount?: number | null;
  /** The provider has not returned the money yet; an Admin settles it (Refund Pending). */
  refundPending?: boolean;
  note?: string | null;
  /** Cancellation reason code (customer cancellations) and free-text details. */
  reason?: string | null;
  details?: string | null;
};

const RESTOCKED: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];
const PROGRESS_STATUSES: OrderStatus[] = [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

const NO_INBOX: SendResult = { status: 'FAILED', attempts: 0, error: 'No business inbox configured (ADMIN_NOTIFY_EMAIL or the site contact email)' };


const CONFIRMABLE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/**
 * Builds and sends every order email: to the customer (in Order.locale) and
 * to the business inbox (always Hebrew; every one carries the order number).
 * Event sends are fire-and-forget through EmailService, which retries, logs to
 * EmailLog (with the orderId) and never throws; the methods themselves swallow
 * lookup errors so callers never fail because of email. `resend` re-renders
 * from the order's current data and is awaited so the admin sees the outcome.
 */
@Injectable()
export class OrderMailer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Business inbox: ADMIN_NOTIFY_EMAIL first, else the site's contact email. */
  async adminInbox(): Promise<string | null> {
    const fromEnv = process.env.ADMIN_NOTIFY_EMAIL?.trim();
    if (fromEnv) return fromEnv;
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' }, select: { contactEmail: true } });
    return config?.contactEmail?.trim() || null;
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
          include: { variant: ITEM_IMAGES_SELECT },
        },
      },
    });
  }

  private pickupPoint(order: Order) {
    return order.deliveryMethod === DeliveryMethod.PICKUP_POINT && order.pickupPointId
      ? this.prisma.pickupPoint.findUnique({ where: { id: order.pickupPointId } })
      : Promise.resolve(null);
  }

  private async safely(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      console.error(`[email] order email failed: ${(err as Error)?.message}`);
    }
  }

  /** Loads the order and runs `send`; missing orders are ignored. */
  private withOrder(orderId: string, send: (order: OrderWithItems) => Promise<unknown>): Promise<void> {
    return this.safely(async () => {
      const order = await this.load(orderId);
      if (order) await send(order);
    });
  }

  private itemRows(order: OrderWithItems, locale: EmailLocale) {
    return order.items.map((i) => ({
      name: (locale === 'he' ? i.productNameHe : null) ?? i.productName,
      color: i.color,
      size: i.size,
      quantity: i.quantity,
      unitPrice: formatMoney(i.unitPrice, locale),
      lineTotal: formatMoney(Number(i.unitPrice) * i.quantity, locale),
      imageUrl: itemImage(i.variant?.product?.images, i.color),
    }));
  }

  private shippingLabel(order: Order, locale: EmailLocale) {
    return Number(order.shippingCost) === 0 ? (locale === 'he' ? 'חינם' : 'Free') : formatMoney(order.shippingCost, locale);
  }

  // ─── Event emails (fire-and-forget) ───────────────────────

  /** Customer confirmation + business alert, after payment. */
  orderConfirmed(orderId: string): Promise<void> {
    return this.withOrder(orderId, async (order) => {
      await Promise.all([this.safely(() => this.sendConfirmation(order)), this.safely(() => this.sendAdminNewOrder(order))]);
    });
  }

  orderProcessing(orderId: string): Promise<void> {
    return this.withOrder(orderId, (order) => this.sendProcessing(order));
  }

  orderShipped(orderId: string): Promise<void> {
    return this.withOrder(orderId, (order) => this.sendShipped(order));
  }

  orderDelivered(orderId: string): Promise<void> {
    return this.withOrder(orderId, (order) => this.sendDelivered(order));
  }

  /** `paid` = money had been taken before the cancellation. Emails the customer AND the business inbox. */
  orderCancelled(orderId: string, paid: boolean, opts: CancelledEmailOptions = {}): Promise<void> {
    return this.withOrder(orderId, async (order) => {
      await Promise.all([
        this.safely(() => this.sendCancelled(order, paid, opts)),
        this.safely(() => this.sendAdminCancelled(order, paid, opts)),
      ]);
    });
  }

  /** The refund reached the customer (provider auto-refund notifies through the cancellation email instead). */
  refundCompleted(refundId: string): Promise<void> {
    return this.safely(async () => {
      const refund = await this.prisma.refund.findUnique({ where: { id: refundId }, select: { orderId: true } });
      if (!refund) return;
      const order = await this.load(refund.orderId);
      if (order) await this.sendRefundCompleted(order, refundId);
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

  /**
   * Admin "resend email": re-renders any order email from the order's current
   * data. 409 when the order has not reached the state that email is about.
   */
  async resend(orderId: string, template: ResendableEmail): Promise<SendResult> {
    const order = await this.load(orderId);
    if (!order) throw new NotFoundException('Order not found');
    const paid = !!order.paidAt;
    const wrongState = (msg: string) => new ConflictException(msg);
    switch (template) {
      case 'order-confirmation':
      case 'admin-new-order':
        if (!paid || !(CONFIRMABLE_STATUSES.includes(order.status) || RESTOCKED.includes(order.status))) {
          throw wrongState('Only paid orders have this email');
        }
        return template === 'order-confirmation' ? this.sendConfirmation(order) : this.sendAdminNewOrder(order);
      case 'order-processing':
        if (!(PROGRESS_STATUSES.includes(order.status))) throw wrongState('The order has not been in progress');
        return this.sendProcessing(order);
      case 'order-shipped':
        if (!order.shippedAt) throw wrongState('The order has not shipped');
        return this.sendShipped(order);
      case 'order-delivered':
        if (!order.deliveredAt) throw wrongState('The order has not been delivered');
        return this.sendDelivered(order);
      case 'order-cancelled': {
        if (!RESTOCKED.includes(order.status)) throw wrongState('The order is not cancelled');
        const info = await this.cancellationInfo(order);
        return this.sendCancelled(order, paid, info);
      }
      case 'refund-completed': {
        const refund = await this.prisma.refund.findFirst({
          where: { orderId, status: RefundStatus.COMPLETED },
          orderBy: { completedAt: 'desc' },
        });
        if (!refund) throw wrongState('The order has no completed refund');
        return this.sendRefundCompleted(order, refund.id);
      }
    }
  }

  /** Refund/fee facts of an already cancelled order, for re-rendering its cancellation email. */
  private async cancellationInfo(order: Order): Promise<CancelledEmailOptions> {
    const [refund, request] = await Promise.all([
      this.prisma.refund.findFirst({ where: { orderId: order.id }, orderBy: { requestedAt: 'desc' } }),
      this.prisma.cancellationRequest.findFirst({
        where: { orderId: order.id, status: { in: [CancellationStatus.APPROVED, CancellationStatus.AUTO_CANCELLED] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      cancelledBy: request?.status === CancellationStatus.AUTO_CANCELLED ? 'customer' : 'admin',
      refundAmount: refund ? Number(refund.amount) : null,
      feeAmount: request?.feeAmount && Number(request.feeAmount) > 0 ? Number(request.feeAmount) : null,
      refundPending: !!refund && refund.status !== RefundStatus.COMPLETED,
      note: request?.adminNote ?? null,
      reason: request?.reason ?? null,
      details: request?.details ?? null,
    };
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

  // ─── Builders (each returns the send outcome) ─────────────

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
        items: this.itemRows(order, locale),
        subtotal: formatMoney(order.subtotal, locale),
        shipping: this.shippingLabel(order, locale),
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
        contactUrl: this.contactUrl(locale),
        payment: this.paymentInfo(order),
      },
    });
  }

  private paymentInfo(order: Order) {
    return {
      method: order.paymentMethod,
      cardBrand: order.cardBrand,
      cardLast4: order.cardLast4,
      installments: order.paymentInstallments,
    };
  }

  private async sendAdminNewOrder(order: OrderWithItems): Promise<SendResult> {
    const to = await this.adminInbox();
    if (!to) return NO_INBOX;
    const discount = Number(order.discountAmount);
    return this.email.deliver('admin-new-order', {
      to,
      locale: 'he',
      meta: { orderId: order.id },
      data: {
        orderNumber: order.orderNumber,
        orderDate: formatDate(order.paidAt ?? order.createdAt, 'he'),
        customer: order.recipientName ?? order.customerEmail,
        email: order.customerEmail,
        phone: order.phone,
        items: this.itemRows(order, 'he'),
        subtotal: formatMoney(order.subtotal, 'he'),
        shipping: this.shippingLabel(order, 'he'),
        discount: discount > 0 ? formatMoney(discount, 'he') : null,
        total: formatMoney(order.total, 'he'),
        itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
        deliveryMethod: order.deliveryMethod,
        addressLines: this.addressLines(order, 'he'),
        payment: this.paymentInfo(order),
        marketingConsent: order.marketingConsent,
        adminUrl: this.adminOrderUrl(order),
      },
    });
  }

  private sendProcessing(order: Order): Promise<SendResult> {
    const locale = normalizeLocale(order.locale);
    return this.email.deliver('order-processing', {
      to: order.customerEmail,
      locale,
      meta: { orderId: order.id },
      data: {
        name: order.recipientName,
        orderNumber: order.orderNumber,
        orderUrl: this.orderUrl(order, locale),
        contactUrl: this.contactUrl(locale),
      },
    });
  }

  private async sendShipped(order: Order): Promise<SendResult> {
    const locale = normalizeLocale(order.locale);
    const [config, point] = await Promise.all([
      this.prisma.siteConfig.findUnique({ where: { id: 'default' } }),
      this.pickupPoint(order),
    ]);
    return this.email.deliver('order-shipped', {
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
  }

  private sendDelivered(order: Order): Promise<SendResult> {
    const locale = normalizeLocale(order.locale);
    return this.email.deliver('order-delivered', {
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
  }

  private sendCancelled(order: Order, paid: boolean, opts: CancelledEmailOptions): Promise<SendResult> {
    const locale = normalizeLocale(order.locale);
    return this.email.deliver('order-cancelled', {
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
  }

  private async sendAdminCancelled(order: Order, paid: boolean, opts: CancelledEmailOptions): Promise<SendResult> {
    const to = await this.adminInbox();
    if (!to) return NO_INBOX;
    return this.email.deliver('admin-order-cancelled', {
      to,
      locale: 'he',
      meta: { orderId: order.id },
      data: {
        orderNumber: order.orderNumber,
        customer: order.recipientName ?? order.customerEmail,
        email: order.customerEmail,
        phone: order.phone,
        total: formatMoney(order.total, 'he'),
        cancelledBy: opts.cancelledBy ?? 'admin',
        paid,
        refundAmount: opts.refundAmount ? formatMoney(opts.refundAmount, 'he') : null,
        feeAmount: opts.feeAmount ? formatMoney(opts.feeAmount, 'he') : null,
        refundPending: opts.refundPending ?? false,
        reason: opts.reason ? (REASON_LABELS_HE[opts.reason] ?? opts.reason) : null,
        details: opts.details ?? null,
        note: opts.note ?? null,
        adminUrl: this.adminOrderUrl(order),
      },
    });
  }

  private async sendRefundCompleted(order: Order, refundId: string): Promise<SendResult> {
    const refund = await this.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
    const locale = normalizeLocale(order.locale);
    const fee = Number(order.total) - Number(refund.amount);
    return this.email.deliver('refund-completed', {
      to: order.customerEmail,
      locale,
      meta: { orderId: order.id },
      data: {
        name: order.recipientName,
        orderNumber: order.orderNumber,
        refundAmount: formatMoney(refund.amount, locale),
        orderTotal: formatMoney(order.total, locale),
        feeAmount: fee > 0.004 ? formatMoney(fee, locale) : null,
        shopUrl: `${clientUrl()}/${locale}`,
        orderUrl: this.orderUrl(order, locale),
        contactUrl: this.contactUrl(locale),
      },
    });
  }

  // ─── Cancellation requests (shipped orders) ───────────────

  cancellationRequested(requestId: string, requiresReturn: boolean): Promise<void> {
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
}
