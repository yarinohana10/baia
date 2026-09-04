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
}
