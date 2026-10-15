import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { Prisma } from '../generated/prisma';
import { generateSecureToken, sha256Hex } from '../common/secure-token';
import type { CartOwner } from '../cart/cart-identity';
import { canAccessOrder, orderTokenTtlMs, type OrderRequester } from './order-access';

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
      throw new BadRequestException('Cart is empty');
    }

    let subtotal = 0;
    const orderItems: {
      variantId: string;
      productName: string;
      color: string;
      size: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }[] = [];

    for (const item of cart.items) {
      const variant = item.variant;
      if (!variant.isActive || !variant.product.isActive) {
        throw new BadRequestException(
          `${variant.product.nameEn} (${variant.color}/${variant.size}) is no longer available`,
        );
      }
      if (variant.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${variant.product.nameEn} (${variant.color}/${variant.size})`,
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
        color: variant.color,
        size: variant.size,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(unitPrice),
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
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: data.owner.userId,
          customerEmail: data.customerEmail,
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

      // Decrement stock atomically
      for (const item of cart.items) {
        const updated = await tx.productVariant.update({
          where: { id: item.variant.id },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (updated.stockQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for ${item.variant.product.nameEn} (${item.variant.color}/${item.variant.size})`,
          );
        }
      }

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

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, coupon: true },
      omit: ORDER_PRIVATE_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
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

  async updateStatus(id: string, status: string, trackingNumber?: string) {
    const order = await this.findById(id);
    const previousStatus = order.status;
    const updateData: Prisma.OrderUpdateInput = { status: status as Prisma.OrderUpdateInput['status'] };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;

    const stockRestoreStatuses = ['CANCELLED', 'REFUNDED'];
    const needsStockRestore =
      stockRestoreStatuses.includes(status) &&
      !stockRestoreStatuses.includes(previousStatus);

    if (needsStockRestore) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id },
          data: updateData,
          include: { items: true },
          omit: ORDER_PRIVATE_FIELDS,
        });

        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }

        return updated;
      });
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: { items: true },
      omit: ORDER_PRIVATE_FIELDS,
    });
  }
}
