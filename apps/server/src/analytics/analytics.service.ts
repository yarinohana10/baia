import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Role } from '../generated/prisma';

/** Orders that count as sales: paid and not cancelled/refunded (PENDING_PAYMENT is excluded). */
export const REVENUE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const revenueStatus = { in: REVENUE_STATUSES };

export const MAX_DAYS = 365;

/** Day ranges are clamped to 1–365; non-numbers fall back to 30. */
export function clampDays(days: number) {
  if (!Number.isFinite(days)) return 30;
  return Math.min(MAX_DAYS, Math.max(1, Math.trunc(days)));
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  async getOverview() {
    const todayStart = this.startOfDay();
    const todayEnd = this.endOfDay();

    const revenueWhere = { status: revenueStatus };

    const [
      totalOrders,
      todayOrders,
      revenueAgg,
      todayRevenueAgg,
      totalCustomers,
      newCustomersToday,
      totalProducts,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.order.aggregate({
        where: revenueWhere,
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: {
          ...revenueWhere,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { total: true },
      }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
      this.prisma.user.count({
        where: {
          role: Role.CUSTOMER,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.product.count(),
      this.prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerEmail: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalOrders,
      todayOrders,
      totalRevenue: Number(revenueAgg._sum.total ?? 0),
      todayRevenue: Number(todayRevenueAgg._sum.total ?? 0),
      totalCustomers,
      newCustomersToday,
      totalProducts,
      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: Number(order.total),
      })),
    };
  }

  async getSales(requestedDays = 30) {
    const days = clampDays(requestedDays);
    const startDate = this.startOfDay();
    startDate.setDate(startDate.getDate() - (days - 1));

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: revenueStatus,
      },
      select: { createdAt: true, total: true },
    });

    const dayMap = new Map<string, { orders: number; revenue: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      dayMap.set(d.toISOString().split('T')[0], { orders: 0, revenue: 0 });
    }

    for (const order of orders) {
      const key = order.createdAt.toISOString().split('T')[0];
      const entry = dayMap.get(key);
      if (entry) {
        entry.orders++;
        entry.revenue += Number(order.total);
      }
    }

    return {
      days: Array.from(dayMap.entries()).map(([date, data]) => ({
        date,
        orders: data.orders,
        revenue: Math.round(data.revenue * 100) / 100,
      })),
    };
  }

  async getOrdersByStatus() {
    const statuses = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return statuses.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));
  }

  /**
   * Best sellers by product (all sizes/colours of a product combined), over
   * sales orders only. `orderCount` is the number of order lines.
   */
  async getTopProducts(requestedLimit = 10) {
    const limit = Math.min(50, Math.max(1, Math.trunc(requestedLimit) || 10));
    const items = await this.prisma.orderItem.groupBy({
      by: ['variantId', 'productName'],
      where: { order: { status: revenueStatus } },
      _sum: { quantity: true },
      _count: { id: true },
    });

    const variants = items.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: [...new Set(items.map((i) => i.variantId))] } },
          select: { id: true, productId: true },
        })
      : [];
    const productOf = new Map(variants.map((v) => [v.id, v.productId]));

    const totals = new Map<
      string,
      { productId: string | null; productName: string; totalQuantity: number; orderCount: number }
    >();
    for (const item of items) {
      const productId = productOf.get(item.variantId) ?? null;
      // Variants that no longer exist are grouped by their snapshot name.
      const key = productId ?? `name:${item.productName}`;
      const entry = totals.get(key) ?? { productId, productName: item.productName, totalQuantity: 0, orderCount: 0 };
      entry.totalQuantity += item._sum.quantity || 0;
      entry.orderCount += item._count.id;
      totals.set(key, entry);
    }

    const top = [...totals.values()]
      .sort((a, b) => b.totalQuantity - a.totalQuantity || b.orderCount - a.orderCount)
      .slice(0, limit);

    const productIds = top.flatMap((t) => (t.productId ? [t.productId] : []));
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            nameHe: true,
            nameEn: true,
            images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
          },
        })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    return top.map((t) => {
      const product = t.productId ? productById.get(t.productId) : undefined;
      return {
        productId: t.productId,
        productName: t.productName,
        totalQuantity: t.totalQuantity,
        orderCount: t.orderCount,
        product: product
          ? {
              id: product.id,
              nameHe: product.nameHe,
              nameEn: product.nameEn,
              image: product.images[0]?.url || null,
            }
          : null,
      };
    });
  }

  async getRevenueByCategory() {
    const orders = await this.prisma.orderItem.findMany({
      where: {
        order: { status: revenueStatus },
      },
      select: {
        quantity: true,
        unitPrice: true,
        variant: {
          select: {
            product: {
              select: {
                category: {
                  select: {
                    id: true,
                    nameHe: true,
                    nameEn: true,
                    parent: { select: { id: true, nameHe: true, nameEn: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const categoryMap = new Map<string, { nameHe: string; nameEn: string; revenue: number; orders: number }>();

    for (const item of orders) {
      const category = item.variant.product.category;
      const topCategory = category.parent || category;
      const key = topCategory.id;

      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          nameHe: topCategory.nameHe,
          nameEn: topCategory.nameEn,
          revenue: 0,
          orders: 0,
        });
      }

      const entry = categoryMap.get(key)!;
      entry.revenue += Number(item.unitPrice) * item.quantity;
      entry.orders++;
    }

    return Array.from(categoryMap.entries()).map(([id, data]) => ({
      categoryId: id,
      ...data,
      revenue: Math.round(data.revenue * 100) / 100,
    }));
  }

  async getCustomerGrowth(requestedDays = 30) {
    const days = clampDays(requestedDays);
    const startDate = this.startOfDay();
    startDate.setDate(startDate.getDate() - (days - 1));

    const customers = await this.prisma.user.findMany({
      where: {
        role: Role.CUSTOMER,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const dayMap = new Map<string, number>();

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      dayMap.set(d.toISOString().split('T')[0], 0);
    }

    for (const customer of customers) {
      const key = customer.createdAt.toISOString().split('T')[0];
      const current = dayMap.get(key);
      if (current !== undefined) {
        dayMap.set(key, current + 1);
      }
    }

    return {
      days: Array.from(dayMap.entries()).map(([date, count]) => ({
        date,
        newCustomers: count,
      })),
    };
  }

  async getInventoryOverview() {
    // Unlimited-stock variants never run out, so they are left out of stock reporting.
    const tracked = { isActive: true, product: { isActive: true } };
    const [variants, unlimitedVariants] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { ...tracked, trackInventory: true },
        select: {
          id: true,
          color: true,
          size: true,
          stockQuantity: true,
          product: {
            select: {
              id: true,
              nameHe: true,
              nameEn: true,
              slug: true,
              isActive: true,
              images: { take: 1, orderBy: { sortOrder: 'asc' }, include: { upload: true } },
            },
          },
        },
      }),
      this.prisma.productVariant.count({ where: { ...tracked, trackInventory: false } }),
    ]);

    const LOW_STOCK_THRESHOLD = 5;

    let totalStock = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    const lowStockItems: {
      variantId: string;
      productId: string;
      productNameHe: string;
      productNameEn: string;
      productSlug: string;
      color: string;
      size: string;
      stockQuantity: number;
      image: string | null;
    }[] = [];

    for (const v of variants) {
      totalStock += v.stockQuantity;
      if (v.stockQuantity === 0) {
        outOfStockCount++;
        lowStockItems.push({
          variantId: v.id,
          productId: v.product.id,
          productNameHe: v.product.nameHe,
          productNameEn: v.product.nameEn,
          productSlug: v.product.slug,
          color: v.color,
          size: v.size,
          stockQuantity: v.stockQuantity,
          image: v.product.images[0]?.url || null,
        });
      } else if (v.stockQuantity <= LOW_STOCK_THRESHOLD) {
        lowStockCount++;
        lowStockItems.push({
          variantId: v.id,
          productId: v.product.id,
          productNameHe: v.product.nameHe,
          productNameEn: v.product.nameEn,
          productSlug: v.product.slug,
          color: v.color,
          size: v.size,
          stockQuantity: v.stockQuantity,
          image: v.product.images[0]?.url || null,
        });
      }
    }

    lowStockItems.sort((a, b) => a.stockQuantity - b.stockQuantity);

    return {
      totalVariants: variants.length + unlimitedVariants,
      unlimitedVariants,
      totalStock,
      outOfStockCount,
      lowStockCount,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      lowStockItems: lowStockItems.slice(0, 20),
    };
  }

  async getAverageOrderValue(requestedDays = 30) {
    const days = clampDays(requestedDays);
    const startDate = this.startOfDay();
    startDate.setDate(startDate.getDate() - (days - 1));

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: revenueStatus,
      },
      select: { createdAt: true, total: true },
    });

    const dayMap = new Map<string, { totalRevenue: number; count: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      dayMap.set(d.toISOString().split('T')[0], { totalRevenue: 0, count: 0 });
    }

    for (const order of orders) {
      const key = order.createdAt.toISOString().split('T')[0];
      const entry = dayMap.get(key);
      if (entry) {
        entry.totalRevenue += Number(order.total);
        entry.count++;
      }
    }

    let overallTotal = 0;
    let overallCount = 0;

    const days_data = Array.from(dayMap.entries()).map(([date, data]) => {
      overallTotal += data.totalRevenue;
      overallCount += data.count;
      return {
        date,
        averageOrderValue: data.count > 0
          ? Math.round((data.totalRevenue / data.count) * 100) / 100
          : 0,
        orderCount: data.count,
      };
    });

    return {
      overallAverage: overallCount > 0
        ? Math.round((overallTotal / overallCount) * 100) / 100
        : 0,
      totalOrders: overallCount,
      days: days_data,
    };
  }
}
