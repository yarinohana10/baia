import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { Prisma } from '../generated/prisma';

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BA-${ts}-${rand}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private couponsService: CouponsService,
  ) {}

  async createOrder(data: {
    userId?: string;
    customerEmail: string;
    couponCode?: string;
    shippingCity: string;
    shippingStreet: string;
    shippingNumber: string;
    shippingApartment?: string;
    shippingZip?: string;
    cartId: string;
  }) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: data.cartId },
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

    const total = subtotal + shippingCost - discountAmount;

    const order = await this.prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: data.userId,
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
        items: { create: orderItems },
      },
      include: { items: true },
    });

    // Decrement stock
    for (const item of cart.items) {
      await this.prisma.productVariant.update({
        where: { id: item.variant.id },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }

    // Increment coupon usage
    if (couponId) {
      await this.prisma.coupon.update({
        where: { id: couponId },
        data: { currentUses: { increment: 1 } },
      });
    }

    // Clear cart
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  }

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, coupon: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { variant: true } }, coupon: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findAll(params?: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params || {};
    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, coupon: true },
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
    const updateData: any = { status };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });
  }
}
