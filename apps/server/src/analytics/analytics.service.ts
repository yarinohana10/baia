import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Role } from '../generated/prisma';

const EXCLUDED_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

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

    const revenueWhere = { status: { notIn: EXCLUDED_STATUSES } };

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

  async getSales(days = 30) {
    const startDate = this.startOfDay();
    startDate.setDate(startDate.getDate() - (days - 1));

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { notIn: EXCLUDED_STATUSES },
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

  async getTopProducts(limit = 10) {
    const items = await this.prisma.orderItem.groupBy({
      by: ['variantId', 'productName'],
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const results = [];
    for (const item of items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: {
          product: {
            include: {
              images: { take: 1, orderBy: { sortOrder: 'asc' }, include: { upload: true } },
            },
          },
        },
      });

      results.push({
        productName: item.productName,
        totalQuantity: item._sum.quantity || 0,
        orderCount: item._count.id,
        variantId: item.variantId,
        product: variant?.product
          ? {
              id: variant.product.id,
              nameHe: variant.product.nameHe,
              nameEn: variant.product.nameEn,
              image: variant.product.images[0]?.url || null,
            }
          : null,
      });
    }

    return results;
  }

  async getRevenueByCategory() {
    const orders = await this.prisma.orderItem.findMany({
      where: {
        order: { status: { notIn: EXCLUDED_STATUSES } },
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

  async getCustomerGrowth(days = 30) {
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

  async getAverageOrderValue(days = 30) {
    const startDate = this.startOfDay();
    startDate.setDate(startDate.getDate() - (days - 1));

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { notIn: EXCLUDED_STATUSES },
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
