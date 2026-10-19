import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { CancellationStatus, DeliveryMethod, OrderStatus, Prisma } from '../generated/prisma';
import { PAYMENT_CLAIM_TTL_MS } from '../payment/payment-claim';
import { generateSecureToken, sha256Hex } from '../common/secure-token';
import type { CartOwner } from '../cart/cart-identity';
import { canAccessOrder, orderTokenTtlMs, signOrderToken, type OrderRequester } from './order-access';
import { hasStock } from '../common/stock';
import { shopBadRequest, shopNotFound } from '../common/error-codes';
import { allowedTransitions, canTransition, RESTOCK_STATUSES } from './order-status';
import { deliveryConfig, deliveryQuote, shippingCostFor } from './delivery';
import { cancellationEligibility, DEFAULT_SELF_CANCEL_WINDOW_HOURS } from './cancellation-eligibility';
import { OrderMailer } from './order-mailer';

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `BA-${ts}-${rand}`;
}

/** Internal fields that must never be serialized to any client (incl. admin). */
export const ORDER_PRIVATE_FIELDS = {
  accessTokenHash: true,
  accessTokenExpiresAt: true,
  paymentClaimedAt: true,
} as const;

const ACCESS_SELECT = {
  id: true,
  userId: true,
  accessTokenHash: true,
  accessTokenExpiresAt: true,
} as const;

export type CreateOrderInput = {
  owner: CartOwner;
  customerEmail: string;
  recipientName: string;
  phone: string;
  locale?: 'he' | 'en';
  couponCode?: string;
  /** Defaults to COURIER. PICKUP_POINT requires pickupPointId. */
  deliveryMethod?: DeliveryMethod;
  pickupPointId?: string;
  marketingConsent?: boolean;
  /** Required for courier delivery; filled from the pickup point otherwise. */
  shippingCity?: string;
  shippingStreet?: string;
  shippingNumber?: string;
  shippingApartment?: string;
  shippingZip?: string;
};

/** Fields of a cancellation request that the order's owner may see. */
const CUSTOMER_REQUEST_SELECT = {
  id: true,
  status: true,
  reason: true,
  feeAmount: true,
  refundAmount: true,
  createdAt: true,
  resolvedAt: true,
} as const;

type PricedVariant = {
  priceOverride: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  saleStart: Date | null;
  saleEnd: Date | null;
  product: { basePrice: Prisma.Decimal };
};

/** Current unit price of a variant: active sale price, else override, else the product base price. */
export function variantUnitPrice(variant: PricedVariant, now = new Date()): number {
  let unitPrice = Number(variant.priceOverride || variant.product.basePrice);
  if (variant.salePrice) {
    const start = variant.saleStart ? new Date(variant.saleStart) : null;
    const end = variant.saleEnd ? new Date(variant.saleEnd) : null;
    if ((!start || now >= start) && (!end || now <= end)) unitPrice = Number(variant.salePrice);
  }
  return unitPrice;
}

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote everything; neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
    private mailer: OrderMailer,
  ) {}

  private cartWhere(owner: CartOwner): Prisma.CartWhereInput {
    return owner.userId ? { userId: owner.userId } : { sessionId: owner.guestKeyHash, userId: null };
  }

  /**
   * Shipping options for the caller's current cart (server-authoritative
   * version of what the checkout shows). Subtotal uses current prices.
   */
  async quote(owner: CartOwner | null) {
    const cart = owner
      ? await this.prisma.cart.findFirst({
          where: this.cartWhere(owner),
          include: { items: { include: { variant: { include: { product: true } } } } },
        })
      : null;
    const subtotal = (cart?.items ?? []).reduce((sum, item) => sum + variantUnitPrice(item.variant) * item.quantity, 0);
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
    return deliveryQuote(subtotal, deliveryConfig(config));
  }

  async selfCancelWindowHours(): Promise<number> {
    const config = await this.prisma.siteConfig.findUnique({
      where: { id: 'default' },
      select: { selfCancelWindowHours: true },
    });
    return config?.selfCancelWindowHours ?? DEFAULT_SELF_CANCEL_WINDOW_HOURS;
  }

  /**
   * Creates an order from the caller's own cart. Returns the order plus, for
   * guest orders only, the raw access token (shown exactly once).
   */
  async createOrder(data: CreateOrderInput) {
    const cartWhere = this.cartWhere(data.owner);
    const deliveryMethod = data.deliveryMethod ?? DeliveryMethod.COURIER;

    // Pickup orders store the point's address in the shipping columns so
    // every existing address display keeps working.
    let shippingAddress: {
      shippingCity: string;
      shippingStreet: string;
      shippingNumber: string;
      shippingApartment: string | null;
      shippingZip: string | null;
    };
    let pickupPoint: { id: string; name: string } | null = null;
    if (deliveryMethod === DeliveryMethod.PICKUP_POINT) {
      const point = data.pickupPointId
        ? await this.prisma.pickupPoint.findFirst({ where: { id: data.pickupPointId, isActive: true } })
        : null;
      if (!point) throw shopBadRequest('PICKUP_POINT_UNAVAILABLE', 'The selected pickup point is not available');
      pickupPoint = { id: point.id, name: point.name };
      shippingAddress = {
        shippingCity: point.city,
        shippingStreet: point.address,
        shippingNumber: '',
        shippingApartment: null,
        shippingZip: null,
      };
    } else {
      if (!data.shippingCity || !data.shippingStreet || !data.shippingNumber) {
        throw shopBadRequest('ADDRESS_REQUIRED', 'A shipping address is required for courier delivery');
      }
      shippingAddress = {
        shippingCity: data.shippingCity,
        shippingStreet: data.shippingStreet,
        shippingNumber: data.shippingNumber,
        shippingApartment: data.shippingApartment || null,
        shippingZip: data.shippingZip || null,
      };
    }

    const cart = await this.prisma.cart.findFirst({
      where: cartWhere,
      include: {
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw shopBadRequest('CART_EMPTY', 'Cart is empty');
    }

    let subtotal = 0;
    const orderItems: {
      variantId: string;
      productName: string;
      productNameHe: string;
      color: string;
      size: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      stockDeducted: boolean;
    }[] = [];

    for (const item of cart.items) {
      const variant = item.variant;
      if (!variant.isActive || !variant.product.isActive) {
        throw shopBadRequest(
          'VARIANT_UNAVAILABLE',
          `${variant.product.nameEn} (${variant.color}/${variant.size}) is no longer available`,
          { variantId: variant.id, productNameHe: variant.product.nameHe, productNameEn: variant.product.nameEn, size: variant.size },
        );
      }
      if (!hasStock(variant, item.quantity)) {
        throw shopBadRequest(
          'OUT_OF_STOCK',
          `Insufficient stock for ${variant.product.nameEn} (${variant.color}/${variant.size})`,
          { variantId: variant.id, productNameHe: variant.product.nameHe, productNameEn: variant.product.nameEn, size: variant.size },
        );
      }

      const unitPrice = variantUnitPrice(variant);

      subtotal += unitPrice * item.quantity;
      orderItems.push({
        variantId: variant.id,
        productName: variant.product.nameEn,
        productNameHe: variant.product.nameHe,
        color: variant.color,
        size: variant.size,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(unitPrice),
        stockDeducted: variant.trackInventory,
      });
    }

    const siteConfig = await this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
    const shippingCost = shippingCostFor(deliveryMethod, subtotal, deliveryConfig(siteConfig));

    let discountAmount = 0;
    let couponId: string | undefined;
    let couponMaxUses: number | null = null;

    if (data.couponCode) {
      const validation = await this.couponsService.validate(data.couponCode, subtotal);
      // Round like the DB column so subtotal + shipping - discount === total exactly.
      discountAmount = Math.round(validation.discount * 100) / 100;
      couponId = validation.coupon.id;
      couponMaxUses = validation.coupon.maxUses;
    }

    const total = Math.max(0, subtotal + shippingCost - discountAmount);

    // Guest orders get a one-time-displayed bearer token; logged-in orders
    // are bound to the user id and need no token.
    const isGuest = !data.owner.userId;
    const accessToken = isGuest ? generateSecureToken() : undefined;

    // Use a transaction to ensure order creation + stock decrement are atomic
    const order = await this.prisma.$transaction(async (tx) => {
      // Reserve stock first. The conditional update never lets stock go below
      // zero, even with concurrent checkouts. Unlimited variants are skipped.
      for (const line of orderItems) {
        if (!line.stockDeducted) continue;
        const reserved = await tx.productVariant.updateMany({
          where: { id: line.variantId, trackInventory: true, stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (reserved.count === 0) {
          throw shopBadRequest('OUT_OF_STOCK', `Insufficient stock for ${line.productName} (${line.color}/${line.size})`, {
            variantId: line.variantId,
            productNameHe: line.productNameHe,
            productNameEn: line.productName,
            size: line.size,
          });
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: data.owner.userId,
          customerEmail: data.customerEmail,
          recipientName: data.recipientName,
          phone: data.phone,
          locale: data.locale ?? 'he',
          subtotal: new Prisma.Decimal(subtotal),
          shippingCost: new Prisma.Decimal(shippingCost),
          discountAmount: new Prisma.Decimal(discountAmount),
          total: new Prisma.Decimal(total),
          couponId,
          deliveryMethod,
          pickupPointId: pickupPoint?.id ?? null,
          pickupPointName: pickupPoint?.name ?? null,
          marketingConsent: data.marketingConsent === true,
          ...shippingAddress,
          accessTokenHash: accessToken ? sha256Hex(accessToken) : null,
          accessTokenExpiresAt: accessToken ? new Date(Date.now() + orderTokenTtlMs()) : null,
          items: { create: orderItems },
        },
        include: { items: true },
        omit: ORDER_PRIVATE_FIELDS,
      });

      // Count the coupon use, conditionally: concurrent checkouts must not
      // push a limited coupon past maxUses (validate() ran outside the tx).
      if (couponId) {
        const used = await tx.coupon.updateMany({
          where: { id: couponId, ...(couponMaxUses ? { currentUses: { lt: couponMaxUses } } : {}) },
          data: { currentUses: { increment: 1 } },
        });
        if (used.count === 0) throw shopBadRequest('COUPON_LIMIT_REACHED', 'Coupon usage limit reached');
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    if (data.marketingConsent === true) await this.recordMarketingConsent(data.customerEmail, data.locale ?? 'he');

    return { order, accessToken };
  }

  /** Unticked-by-default checkout box: opt the shopper in to the newsletter (re-subscribes). */
  private async recordMarketingConsent(email: string, locale: string) {
    const normalized = email.trim().toLowerCase();
    try {
      await this.prisma.newsletterSubscriber.upsert({
        where: { email: normalized },
        create: { email: normalized, locale, source: 'checkout', consentAt: new Date() },
        update: { unsubscribedAt: null, consentAt: new Date(), locale },
      });
    } catch (err) {
      // Consent bookkeeping must never fail the order itself.
      this.logger.warn(`could not record marketing consent: ${(err as Error)?.message}`);
    }
  }

  /**
   * A fresh access token for an order, for emailed links and order lookup.
   * Signed (HMAC) rather than stored, so it does NOT invalidate the token the
   * shopper already holds (see order-access.ts).
   */
  async issueGuestAccessToken(orderId: string): Promise<string> {
    return signOrderToken(orderId);
  }

  /**
   * Public order lookup by order number + email (case-insensitive). Any
   * mismatch is the same 404, so neither order numbers nor emails can be
   * probed. Returns a signed access token for the order page.
   */
  async lookup(orderNumber: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim().toUpperCase(),
        customerEmail: { equals: email.trim(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (!order) throw shopNotFound('ORDER_LOOKUP_FAILED', 'No order matches these details');
    return { orderId: order.id, accessToken: signOrderToken(order.id) };
  }

  /** A page of the user's own orders, newest first, each with its cancellation options. */
  async findByUser(userId: string, params: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = params;
    const where: Prisma.OrderWhereInput = { userId };
    const [orders, total, windowHours] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          coupon: true,
          cancellationRequests: { select: CUSTOMER_REQUEST_SELECT, orderBy: { createdAt: 'desc' } },
        },
        omit: ORDER_PRIVATE_FIELDS,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
      this.selfCancelWindowHours(),
    ]);
    return {
      orders: orders.map((o) => this.withCancellation(o, windowHours)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Adds `cancellation` (what the customer may do now) to an order that carries its requests. */
  withCancellation<
    T extends {
      status: OrderStatus;
      paidAt: Date | null;
      createdAt: Date;
      shippedAt: Date | null;
      cancellationRequests: { id: string; status: CancellationStatus; reason: string; createdAt: Date }[];
    },
  >(order: T, windowHours: number, now = new Date()) {
    const open = order.cancellationRequests.find((r) => r.status === CancellationStatus.REQUESTED) ?? null;
    return {
      ...order,
      cancellation: cancellationEligibility(
        order,
        windowHours,
        open ? { id: open.id, status: open.status, reason: open.reason, createdAt: open.createdAt } : null,
        now,
      ),
    };
  }

  /** The order as its owner (or a token holder) sees it. */
  async findForCustomer(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { variant: true } },
        coupon: true,
        cancellationRequests: { select: CUSTOMER_REQUEST_SELECT, orderBy: { createdAt: 'desc' } },
      },
      omit: ORDER_PRIVATE_FIELDS,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.withCancellation(order, await this.selfCancelWindowHours());
  }

  /**
   * Loads the minimal fields needed for an ownership decision and throws 404
   * (never 401/403) when the requester has no proof, so the existence of an
   * order id is not revealed.
   */
  async assertAccess(id: string, requester: OrderRequester, opts: { allowAdmin: boolean }) {
    const access = await this.prisma.order.findUnique({ where: { id }, select: ACCESS_SELECT });
    if (!access || !canAccessOrder(access, requester, opts)) {
      throw new NotFoundException('Order not found');
    }
    return access;
  }

  async findForRequester(id: string, requester: OrderRequester) {
    await this.assertAccess(id, requester, { allowAdmin: true });
    return this.findForCustomer(id);
  }

  /** Admin detail: every cancellation request (incl. notes) and the customer's options. */
  async findForAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { variant: true } },
        coupon: true,
        cancellationRequests: { orderBy: { createdAt: 'desc' } },
      },
      omit: ORDER_PRIVATE_FIELDS,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.withCancellation(order, await this.selfCancelWindowHours());
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { variant: true } }, coupon: true },
      omit: ORDER_PRIVATE_FIELDS,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private adminWhere(params: { status?: OrderStatus; search?: string; from?: Date; to?: Date }) {
    const where: Prisma.OrderWhereInput = {};
    if (params.status) where.status = params.status;
    const term = params.search?.trim();
    if (term) {
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customerEmail: { contains: term, mode: 'insensitive' } },
        { recipientName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
      ];
    }
    if (params.from || params.to) where.createdAt = { gte: params.from, lte: params.to };
    return where;
  }

  /** Admin list. Each order carries `allowedTransitions` and its open cancellation request, if any. */
  async findAll(params?: { status?: OrderStatus; search?: string; page?: number; limit?: number }) {
    const { status, search, page = 1, limit = 20 } = params || {};
    const where = this.adminWhere({ status, search });

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          coupon: true,
          cancellationRequests: {
            where: { status: CancellationStatus.REQUESTED },
            select: { id: true, status: true, reason: true, createdAt: true },
          },
        },
        omit: ORDER_PRIVATE_FIELDS,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map((o) => ({ ...o, allowedTransitions: allowedTransitions(o.status) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Orders created in [from, to] as CSV (UTF-8 with BOM so Excel shows Hebrew). */
  async exportCsv(params: { from?: Date; to?: Date; status?: OrderStatus }) {
    const orders = await this.prisma.order.findMany({
      where: this.adminWhere(params),
      include: { items: true, coupon: { select: { code: true } } },
      omit: ORDER_PRIVATE_FIELDS,
      orderBy: { createdAt: 'asc' },
      take: 10_000,
    });
    const header = [
      'orderNumber',
      'createdAt',
      'paidAt',
      'status',
      'customerEmail',
      'recipientName',
      'phone',
      'deliveryMethod',
      'pickupPoint',
      'city',
      'address',
      'items',
      'subtotal',
      'shipping',
      'discount',
      'coupon',
      'total',
      'trackingNumber',
      'marketingConsent',
    ];
    const rows = orders.map((o) => [
      o.orderNumber,
      o.createdAt.toISOString(),
      o.paidAt?.toISOString() ?? '',
      o.status,
      o.customerEmail,
      o.recipientName ?? '',
      o.phone ?? '',
      o.deliveryMethod,
      o.pickupPointName ?? '',
      o.shippingCity,
      [o.shippingStreet, o.shippingNumber, o.shippingApartment].filter(Boolean).join(' '),
      o.items.map((i) => `${i.quantity}x ${i.productNameHe ?? i.productName} (${i.color}/${i.size})`).join('; '),
      o.subtotal.toString(),
      o.shippingCost.toString(),
      o.discountAmount.toString(),
      o.coupon?.code ?? '',
      o.total.toString(),
      o.trackingNumber ?? '',
      o.marketingConsent ? 'yes' : 'no',
    ]);
    return '\uFEFF' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  /**
   * Admin status change. Stamps paidAt / shippedAt / cancelledAt, returns
   * stock for CANCELLED/REFUNDED, and (unless `notify: false`) emails the
   * customer about SHIPPED, DELIVERED and cancellations.
   */
  async updateStatus(id: string, status: OrderStatus, trackingNumber?: string, opts: { notify?: boolean } = {}) {
    const order = await this.findById(id);
    const previousStatus = order.status;
    if (status !== previousStatus && !canTransition(previousStatus, status)) {
      throw new ConflictException(`Cannot change an order from ${previousStatus} to ${status}`);
    }

    const updateData: Prisma.OrderUpdateInput = { status };
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber.trim() || null;
    const changed = status !== previousStatus;
    const now = new Date();
    if (changed && status === OrderStatus.CONFIRMED && !order.paidAt) updateData.paidAt = now;
    if (changed && status === OrderStatus.SHIPPED && !order.shippedAt) updateData.shippedAt = now;
    if (changed && RESTOCK_STATUSES.includes(status) && !order.cancelledAt) updateData.cancelledAt = now;

    const restock = RESTOCK_STATUSES.includes(status) && !RESTOCK_STATUSES.includes(previousStatus);
    // Every write is conditional on the status we read, so a concurrent change
    // (e.g. the customer self-cancelling while an admin marks it shipped)
    // cannot be silently overwritten, and two concurrent cancels restock once.
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id, status: previousStatus }, data: { status } });
      if (claimed.count === 0) throw new ConflictException('Order status changed, reload and try again');
      if (restock) await this.releaseOrderResources(tx, order);
      return tx.order.update({
        where: { id },
        data: updateData,
        include: { items: true },
        omit: ORDER_PRIVATE_FIELDS,
      });
    });

    if (changed && opts.notify !== false) {
      if (status === OrderStatus.SHIPPED) void this.mailer.orderShipped(id);
      else if (status === OrderStatus.DELIVERED) void this.mailer.orderDelivered(id);
      else if (restock) void this.mailer.orderCancelled(id, previousStatus !== OrderStatus.PENDING_PAYMENT);
    }
    return updated;
  }

  /**
   * Cancels unpaid orders older than `maxAgeMs` and returns their stock and
   * coupon use, so abandoned checkouts don't hold inventory forever. Orders
   * with a payment in flight (fresh claim) are left alone.
   */
  async releaseExpiredPendingOrders(maxAgeMs: number, now = new Date()) {
    const cutoff = new Date(now.getTime() - maxAgeMs);
    const claimCutoff = new Date(now.getTime() - PAYMENT_CLAIM_TTL_MS);
    const stale = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING_PAYMENT, createdAt: { lt: cutoff } },
      select: { id: true },
      take: 100,
    });
    let released = 0;
    for (const { id } of stale) {
      const done = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id,
            status: OrderStatus.PENDING_PAYMENT,
            OR: [{ paymentClaimedAt: null }, { paymentClaimedAt: { lt: claimCutoff } }],
          },
          data: { status: OrderStatus.CANCELLED, cancelledAt: now },
        });
        if (claimed.count === 0) return false;
        const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
        await this.releaseOrderResources(tx, order);
        return true;
      });
      if (done) released += 1;
    }
    return released;
  }

  private async releaseOrderResources(
    tx: Prisma.TransactionClient,
    order: { couponId: string | null; items: { variantId: string; quantity: number; stockDeducted: boolean }[] },
  ) {
    for (const item of order.items) {
      if (!item.stockDeducted) continue;
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
    if (order.couponId) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, currentUses: { gt: 0 } },
        data: { currentUses: { decrement: 1 } },
      });
    }
  }
}
