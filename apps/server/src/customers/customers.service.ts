import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma';
import { REVENUE_STATUSES } from '../analytics/analytics.service';

const CUSTOMER_SELECT = { id: true, name: true, email: true, emailVerified: true, createdAt: true } as const;

/** Paid orders only (same statuses analytics counts as revenue). */
const paidOrder = { status: { in: REVENUE_STATUSES } };

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Registered customers (role CUSTOMER), newest first, with paid order count
   * and total spent. `search` matches name or email.
   */
  async findAll(params: { search?: string; page: number; limit: number }) {
    const { page, limit } = params;
    const term = params.search?.trim();
    const where: Prisma.UserWhereInput = { role: 'CUSTOMER' };
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const stats = users.length
      ? await this.prisma.order.groupBy({
          by: ['userId'],
          where: { ...paidOrder, userId: { in: users.map((u) => u.id) } },
          _count: { _all: true },
          _sum: { total: true },
        })
      : [];
    const byUser = new Map(stats.map((s) => [s.userId, s]));

    return {
      customers: users.map((u) => {
        const s = byUser.get(u.id);
        return { ...u, orderCount: s?._count._all ?? 0, totalSpent: Number(s?._sum.total ?? 0) };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** One customer with all their orders (every status, newest first) and paid totals. */
  async findById(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'CUSTOMER' }, select: CUSTOMER_SELECT });
    if (!user) throw new NotFoundException('Customer not found');

    const [orders, paid] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.aggregate({
        where: { ...paidOrder, userId: id },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    return {
      ...user,
      orderCount: paid._count._all,
      totalSpent: Number(paid._sum.total ?? 0),
      orders: orders.map(({ _count, total, ...o }) => ({ ...o, total: Number(total), itemCount: _count.items })),
    };
  }
}
