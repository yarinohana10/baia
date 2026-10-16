import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { OrderStatus, Prisma } from '../generated/prisma';
import { PAYMENT_CLAIM_TTL_MS } from '../payment/payment-claim';
import { generateSecureToken, sha256Hex } from '../common/secure-token';
import type { CartOwner } from '../cart/cart-identity';
import { canAccessOrder, orderTokenTtlMs, type OrderRequester } from './order-access';
import { hasStock } from '../common/stock';
import { shopBadRequest } from '../common/error-codes';
import { canTransition, RESTOCK_STATUSES } from './order-status';

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
  shippingCity: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment?: string;
  shippingZip?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
  ) {}

  /**
   * Creates an order from the caller's own cart. Returns the order plus, for
   * guest orders only, the raw access token (shown exactly once).
   */
  async createOrder(data: CreateOrderInput) {
    const cartWhere: Prisma.CartWhereInput = data.owner.userId
      ? { userId: data.owner.userId }
      : { sessionId: data.owner.guestKeyHash, userId: null };

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

      let unitPrice = Number(variant.priceOverride || variant.product.basePrice);

      if (variant.salePrice) {
        const now = new Date();
        const start = variant.saleStart ? new Date(variant.saleStart) : null;
        const end = variant.saleEnd ? new Date(variant.saleEnd) : null;
        if ((!start || now >= start) && (!end || now <= end)) {
          unitPrice = Number(variant.salePrice);
        }
      }

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
    const freeThreshold = siteConfig ? Number(siteConfig.freeShippingThreshold) : 249;
    const shippingCost = subtotal >= freeThreshold ? 0 : (siteConfig ? Number(siteConfig.shippingCost) : 29.9);

    let discountAmount = 0;
    let couponId: string | undefined;

    if (data.couponCode) {
      const validation = await this.couponsService.validate(data.couponCode, subtotal);
      discountAmount = validation.discount;
      couponId = validation.coupon.id;
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
          shippingCity: data.shippingCity,
          shippingStreet: data.shippingStreet,
          shippingNumber: data.shippingNumber,
          shippingApartment: data.shippingApartment,
          shippingZip: data.shippingZip,
          accessTokenHash: accessToken ? sha256Hex(accessToken) : null,
          accessTokenExpiresAt: accessToken ? new Date(Date.now() + orderTokenTtlMs()) : null,
          items: { create: orderItems },
        },
        include: { items: true },
        omit: ORDER_PRIVATE_FIELDS,
      });

      // Increment coupon usage
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { currentUses: { increment: 1 } },
        });
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    return { order, accessToken };
  }

  /**
   * Rotate (or mint) the guest access token for an order. Intended for the
   * future confirmation-email sender; invalidates any previous token.
   */
  async issueGuestAccessToken(orderId: string): Promise<string> {
    const token = generateSecureToken();
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        accessTokenHash: sha256Hex(token),
        accessTokenExpiresAt: new Date(Date.now() + orderTokenTtlMs()),
      },
    });
    return token;
  }

  /** A page of the user's own orders, newest first. */
  async findByUser(userId: string, params: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = params;
    const where: Prisma.OrderWhereInput = { userId };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, coupon: true },
        omit: ORDER_PRIVATE_FIELDS,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total, page, totalPages: Math.ceil(total / limit) };
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
    return this.findById(id);
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

  async findAll(params?: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params || {};
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as Prisma.OrderWhereInput['status'];

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, coupon: true },
        omit: ORDER_PRIVATE_FIELDS,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateStatus(id: string, status: OrderStatus, trackingNumber?: string) {
    const order = await this.findById(id);
    const previousStatus = order.status;
    if (status !== previousStatus && !canTransition(previousStatus, status)) {
      throw new ConflictException(`Cannot change an order from ${previousStatus} to ${status}`);
    }

    const updateData: Prisma.OrderUpdateInput = { status };
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber.trim() || null;

    const restock = RESTOCK_STATUSES.includes(status) && !RESTOCK_STATUSES.includes(previousStatus);
    if (!restock) {
      return this.prisma.order.update({
        where: { id },
        data: updateData,
        include: { items: true },
        omit: ORDER_PRIVATE_FIELDS,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Conditional on the status we read, so two concurrent cancels restock once.
      const claimed = await tx.order.updateMany({ where: { id, status: previousStatus }, data: { status } });
      if (claimed.count === 0) throw new ConflictException('Order status changed, reload and try again');
      await this.releaseOrderResources(tx, order);
      return tx.order.update({
        where: { id },
        data: updateData,
        include: { items: true },
        omit: ORDER_PRIVATE_FIELDS,
      });
    });
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
          data: { status: OrderStatus.CANCELLED },
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
