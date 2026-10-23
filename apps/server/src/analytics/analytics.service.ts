import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Prisma, Role } from '../generated/prisma';
import {
  Bucket,
  DayRange,
  RangeInput,
  ResolvedRange,
  STORE_TIME_ZONE,
  addDays,
  bucketKeys,
  changePct,
  dayKey,
  resolveRange,
  startOfDay,
} from './date-range';

/** Orders that count as sales: paid and not cancelled/refunded (PENDING_PAYMENT is excluded). */
export const REVENUE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const revenueStatus = { in: REVENUE_STATUSES };

/** Rows an orders CSV export is cut at (keeps memory bounded). */
export const EXPORT_ROW_LIMIT = 20_000;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const round2 = (n: number | null | undefined) => Math.round(Number(n ?? 0) * 100) / 100;

/** `col` (a UTC `timestamp` column) as Israel wall-clock time. `col` is always a code constant. */
const localTime = (col: string) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${STORE_TIME_ZONE}')`;

/** SQL for the bucket (YYYY-MM-DD of its first day; weeks start Sunday) a timestamp column falls in. */
function bucketSql(col: string, bucket: Bucket) {
  const local = localTime(col);
  if (bucket === 'week') {
    return Prisma.raw(`to_char(date_trunc('week', ${local} + interval '1 day') - interval '1 day', 'YYYY-MM-DD')`);
  }
  return Prisma.raw(`to_char(date_trunc('${bucket}', ${local}), 'YYYY-MM-DD')`);
}

const inRange = (col: string, r: DayRange) =>
  Prisma.sql`${Prisma.raw(col)} >= ${r.from} AND ${Prisma.raw(col)} < ${r.to}`;

/** Sales orders in a period: joins `orders o` + `order_items oi`. */
const salesItemsWhere = (r: DayRange) =>
  Prisma.sql`o.status::text = ANY(${REVENUE_STATUSES}) AND ${inRange('o."createdAt"', r)}`;

export type PeriodMetrics = ReturnType<AnalyticsService['emptyMetrics']>;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /** The range a request asks for. "All time" starts on the first order's day. */
  async resolve(input: RangeInput, now = new Date()): Promise<ResolvedRange> {
    let earliest: Date | null = null;
    if (input.preset === 'all_time' && input.from === undefined && input.to === undefined) {
      earliest = (await this.prisma.order.aggregate({ _min: { createdAt: true } }))._min.createdAt;
    }
    return resolveRange(input, now, earliest);
  }

  emptyMetrics() {
    return {
      /** Sales orders (paid, not cancelled/refunded): what revenue and the average are over. */
      orders: 0,
      /** Orders that were paid, including ones cancelled or refunded afterwards. */
      placed: 0,
      /** Orders created but never paid (checkout abandoned). */
      pendingPayment: 0,
      revenue: 0,
      averageOrderValue: 0,
      unitsSold: 0,
      discountTotal: 0,
      shippingRevenue: 0,
      /** Sales orders that used a coupon. */
      couponOrders: 0,
      /** Orders delivered in the period (by deliveredAt) and their value. */
      delivered: 0,
      deliveredRevenue: 0,
      /** Orders shipped in the period (by shippedAt) that are still shipped or delivered. */
      shipped: 0,
      /** Orders placed in the period that are now cancelled / refunded. */
      cancelled: 0,
      cancelledValue: 0,
      refunded: 0,
      refundedValue: 0,
      /** Buyers of sales orders in the period: first purchase ever vs bought before. */
      newCustomers: 0,
      returningCustomers: 0,
      /** Accounts registered in the period. */
      newAccounts: 0,
    };
  }

  /** Every headline number for one period. */
  async periodMetrics(r: DayRange): Promise<PeriodMetrics> {
    const [byStatus, units, delivered, shipped, couponOrders, customers, newAccounts] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: r.from, lt: r.to } },
        _count: { _all: true },
        _sum: { total: true, discountAmount: true, shippingCost: true },
      }),
      this.prisma.orderItem.aggregate({
        where: { order: { status: revenueStatus, createdAt: { gte: r.from, lt: r.to } } },
        _sum: { quantity: true },
      }),
      this.prisma.order.aggregate({
        where: { status: 'DELIVERED', deliveredAt: { gte: r.from, lt: r.to } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { status: { in: ['SHIPPED', 'DELIVERED'] }, shippedAt: { gte: r.from, lt: r.to } },
      }),
      this.prisma.order.count({
        where: { status: revenueStatus, couponId: { not: null }, createdAt: { gte: r.from, lt: r.to } },
      }),
      this.customerSplit(r),
      this.prisma.user.count({ where: { role: Role.CUSTOMER, createdAt: { gte: r.from, lt: r.to } } }),
    ]);

    const m = this.emptyMetrics();
    for (const row of byStatus) {
      const count = row._count._all;
      const total = Number(row._sum.total ?? 0);
      if (row.status === 'PENDING_PAYMENT') {
        m.pendingPayment = count;
        continue;
      }
      m.placed += count;
      if (row.status === 'CANCELLED') {
        m.cancelled = count;
        m.cancelledValue = total;
      } else if (row.status === 'REFUNDED') {
        m.refunded = count;
        m.refundedValue = total;
      } else {
        m.orders += count;
        m.revenue += total;
        m.discountTotal += Number(row._sum.discountAmount ?? 0);
        m.shippingRevenue += Number(row._sum.shippingCost ?? 0);
      }
    }
    m.averageOrderValue = m.orders > 0 ? m.revenue / m.orders : 0;
    m.unitsSold = units._sum.quantity ?? 0;
    m.delivered = delivered._count._all;
    m.deliveredRevenue = Number(delivered._sum.total ?? 0);
    m.shipped = shipped;
    m.couponOrders = couponOrders;
    m.newCustomers = customers.newCustomers;
    m.returningCustomers = customers.returningCustomers;
    m.newAccounts = newAccounts;

    for (const key of ['revenue', 'averageOrderValue', 'discountTotal', 'shippingRevenue', 'deliveredRevenue', 'cancelledValue', 'refundedValue'] as const) {
      m[key] = round2(m[key]);
    }
    return m;
  }

  /** Distinct buyers of sales orders in the period, split by whether they had bought before it. */
  private async customerSplit(r: DayRange) {
    const [row] = await this.prisma.$queryRaw<{ total: number; returning: number }[]>(Prisma.sql`
      WITH buyers AS (
        SELECT DISTINCT lower(o."customerEmail") AS email
        FROM orders o
        WHERE o.status::text = ANY(${REVENUE_STATUSES}) AND ${inRange('o."createdAt"', r)}
      )
      SELECT count(*)::int AS total,
             (count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM orders p
               WHERE lower(p."customerEmail") = buyers.email
                 AND p.status::text = ANY(${REVENUE_STATUSES})
                 AND p."createdAt" < ${r.from}
             )))::int AS returning
      FROM buyers`);
    const total = row?.total ?? 0;
    const returningCustomers = row?.returning ?? 0;
    return { newCustomers: total - returningCustomers, returningCustomers };
  }

  /** Headline metrics for the range and for the equal-length period right before it. */
  async getSummary(range: ResolvedRange) {
    const [current, previous] = await Promise.all([
      this.periodMetrics(range),
      range.previous ? this.periodMetrics(range.previous) : Promise.resolve(null),
    ]);
    const change = previous
      ? (Object.fromEntries(
          (Object.keys(current) as (keyof PeriodMetrics)[]).map((k) => [k, changePct(current[k], previous[k])]),
        ) as Record<keyof PeriodMetrics, number | null>)
      : null;
    return { range: this.describe(range), current, previous, change };
  }

  private describe(range: ResolvedRange) {
    const day = (r: DayRange) => ({ fromDay: r.fromDay, toDay: r.toDay, days: r.days });
    return {
      preset: range.preset,
      ...day(range),
      bucket: range.bucket,
      timeZone: STORE_TIME_ZONE,
      previous: range.previous ? day(range.previous) : null,
    };
  }

  /** Revenue, orders, units and deliveries per day/week/month (empty buckets are zero). */
  async getSales(range: ResolvedRange) {
    const { bucket } = range;
    const [sales, units, delivered] = await Promise.all([
      this.prisma.$queryRaw<{ bucket: string; orders: number; revenue: number }[]>(Prisma.sql`
        SELECT ${bucketSql('o."createdAt"', bucket)} AS bucket, count(*)::int AS orders, COALESCE(sum(o.total), 0)::float8 AS revenue
        FROM orders o
        WHERE ${salesItemsWhere(range)}
        GROUP BY 1`),
      this.prisma.$queryRaw<{ bucket: string; units: number }[]>(Prisma.sql`
        SELECT ${bucketSql('o."createdAt"', bucket)} AS bucket, COALESCE(sum(oi.quantity), 0)::int AS units
        FROM order_items oi JOIN orders o ON o.id = oi."orderId"
        WHERE ${salesItemsWhere(range)}
        GROUP BY 1`),
      this.prisma.$queryRaw<{ bucket: string; delivered: number; revenue: number }[]>(Prisma.sql`
        SELECT ${bucketSql('o."deliveredAt"', bucket)} AS bucket, count(*)::int AS delivered, COALESCE(sum(o.total), 0)::float8 AS revenue
        FROM orders o
        WHERE o.status = 'DELIVERED' AND ${inRange('o."deliveredAt"', range)}
        GROUP BY 1`),
    ]);

    const points = new Map(
      bucketKeys(range, bucket).map((date) => [
        date,
        { date, orders: 0, revenue: 0, units: 0, delivered: 0, deliveredRevenue: 0 },
      ]),
    );
    for (const row of sales) {
      const p = points.get(row.bucket);
      if (p) Object.assign(p, { orders: row.orders, revenue: round2(row.revenue) });
    }
    for (const row of units) {
      const p = points.get(row.bucket);
      if (p) p.units = row.units;
    }
    for (const row of delivered) {
      const p = points.get(row.bucket);
      if (p) Object.assign(p, { delivered: row.delivered, deliveredRevenue: round2(row.revenue) });
    }
    return { range: this.describe(range), bucket, points: [...points.values()] };
  }

  /** Orders created in the range, by current status. */
  async getOrdersByStatus(range: ResolvedRange) {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.from, lt: range.to } },
      _count: { _all: true },
      _sum: { total: true },
    });
    return {
      range: this.describe(range),
      statuses: rows.map((s) => ({ status: s.status, count: s._count._all, value: round2(Number(s._sum.total ?? 0)) })),
    };
  }

  /**
   * Best sellers in the range, by units and by line revenue (quantity x unit
   * price, before order-level discounts), all colours and sizes of a product combined.
   */
  async getTopProducts(range: ResolvedRange, requestedLimit = 10) {
    const limit = Math.min(50, Math.max(1, Math.trunc(requestedLimit) || 10));
    const query = (order: 'units' | 'revenue') =>
      this.prisma.$queryRaw<
        { productId: string; nameHe: string; nameEn: string; units: number; revenue: number; orders: number }[]
      >(Prisma.sql`
        SELECT p.id AS "productId", p."nameHe", p."nameEn",
               sum(oi.quantity)::int AS units,
               sum(oi.quantity * oi."unitPrice")::float8 AS revenue,
               count(DISTINCT oi."orderId")::int AS orders
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        JOIN product_variants v ON v.id = oi."variantId"
        JOIN products p ON p.id = v."productId"
        WHERE ${salesItemsWhere(range)}
        GROUP BY p.id
        ORDER BY ${Prisma.raw(order)} DESC, p."nameEn" ASC
        LIMIT ${limit}`);
    const [byUnits, byRevenue] = await Promise.all([query('units'), query('revenue')]);

    const ids = [...new Set([...byUnits, ...byRevenue].map((r) => r.productId))];
    const images = ids.length
      ? await this.prisma.productImage.findMany({
          where: { productId: { in: ids } },
          orderBy: { sortOrder: 'asc' },
          select: { productId: true, url: true },
        })
      : [];
    const imageOf = new Map<string, string>();
    for (const img of images) if (!imageOf.has(img.productId)) imageOf.set(img.productId, img.url);

    const shape = (rows: typeof byUnits) =>
      rows.map((r) => ({ ...r, revenue: round2(r.revenue), image: imageOf.get(r.productId) ?? null }));
    return { range: this.describe(range), byUnits: shape(byUnits), byRevenue: shape(byRevenue) };
  }

  /** Line revenue by top-level category (audience) and by product type (the product's own category). */
  async getRevenueByCategory(range: ResolvedRange) {
    const base = Prisma.sql`
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      JOIN product_variants v ON v.id = oi."variantId"
      JOIN products p ON p.id = v."productId"
      JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN categories cp ON cp.id = c."parentId"
      WHERE ${salesItemsWhere(range)}`;
    type Row = { categoryId: string; nameHe: string; nameEn: string; revenue: number; units: number; orders: number };
    const [topLevel, byType] = await Promise.all([
      this.prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT COALESCE(cp.id, c.id) AS "categoryId", COALESCE(cp."nameHe", c."nameHe") AS "nameHe", COALESCE(cp."nameEn", c."nameEn") AS "nameEn",
               sum(oi.quantity * oi."unitPrice")::float8 AS revenue, sum(oi.quantity)::int AS units, count(DISTINCT oi."orderId")::int AS orders
        ${base}
        GROUP BY 1, 2, 3
        ORDER BY revenue DESC`),
      this.prisma.$queryRaw<(Row & { parentId: string | null; parentNameHe: string | null; parentNameEn: string | null })[]>(Prisma.sql`
        SELECT c.id AS "categoryId", c."nameHe", c."nameEn", cp.id AS "parentId", cp."nameHe" AS "parentNameHe", cp."nameEn" AS "parentNameEn",
               sum(oi.quantity * oi."unitPrice")::float8 AS revenue, sum(oi.quantity)::int AS units, count(DISTINCT oi."orderId")::int AS orders
        ${base}
        GROUP BY c.id, cp.id
        ORDER BY revenue DESC`),
    ]);
    const shape = <T extends { revenue: number }>(rows: T[]) => rows.map((r) => ({ ...r, revenue: round2(r.revenue) }));
    return { range: this.describe(range), topLevel: shape(topLevel), byType: shape(byType) };
  }

  /** Units and line revenue per colour and per size sold in the range. */
  async getSalesBreakdown(range: ResolvedRange) {
    const query = (column: 'color' | 'size') =>
      this.prisma.$queryRaw<{ value: string; units: number; revenue: number }[]>(Prisma.sql`
        SELECT oi.${Prisma.raw(`"${column}"`)} AS value, sum(oi.quantity)::int AS units, sum(oi.quantity * oi."unitPrice")::float8 AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi."orderId"
        WHERE ${salesItemsWhere(range)}
        GROUP BY 1
        ORDER BY units DESC, value ASC
        LIMIT 20`);
    const [byColor, bySize] = await Promise.all([query('color'), query('size')]);
    const shape = (rows: { value: string; units: number; revenue: number }[]) =>
      rows.map((r) => ({ ...r, revenue: round2(r.revenue) }));
    return { range: this.describe(range), byColor: shape(byColor), bySize: shape(bySize) };
  }

  /** New customer accounts per day/week/month. */
  async getCustomerGrowth(range: ResolvedRange) {
    const rows = await this.prisma.$queryRaw<{ bucket: string; count: number }[]>(Prisma.sql`
      SELECT ${bucketSql('u."createdAt"', range.bucket)} AS bucket, count(*)::int AS count
      FROM users u
      WHERE u.role::text = ${Role.CUSTOMER} AND ${inRange('u."createdAt"', range)}
      GROUP BY 1`);
    const points = new Map(bucketKeys(range, range.bucket).map((date) => [date, { date, newCustomers: 0 }]));
    for (const row of rows) {
      const p = points.get(row.bucket);
      if (p) p.newCustomers = row.count;
    }
    return { range: this.describe(range), bucket: range.bucket, points: [...points.values()] };
  }

  /** Today (Israel) and all-time totals plus the latest orders. */
  async getOverview(now = new Date()) {
    const today = dayKey(now);
    const todayStart = startOfDay(today);
    const todayEnd = startOfDay(addDays(today, 1));
    const todayRange = { gte: todayStart, lt: todayEnd };

    const [totalOrders, todayOrders, revenueAgg, todayRevenueAgg, totalCustomers, newCustomersToday, totalProducts, recentOrders] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({ where: { createdAt: todayRange } }),
        this.prisma.order.aggregate({ where: { status: revenueStatus }, _sum: { total: true } }),
        this.prisma.order.aggregate({ where: { status: revenueStatus, createdAt: todayRange }, _sum: { total: true } }),
        this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
        this.prisma.user.count({ where: { role: Role.CUSTOMER, createdAt: todayRange } }),
        this.prisma.product.count(),
        this.prisma.order.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, customerEmail: true, total: true, status: true, createdAt: true },
        }),
      ]);

    return {
      totalOrders,
      todayOrders,
      totalRevenue: round2(Number(revenueAgg._sum.total ?? 0)),
      todayRevenue: round2(Number(todayRevenueAgg._sum.total ?? 0)),
      totalCustomers,
      newCustomersToday,
      totalProducts,
      recentOrders: recentOrders.map((order) => ({ ...order, total: Number(order.total) })),
    };
  }

  /**
   * Stock health against SiteConfig.lowStockThreshold. Only tracked variants of
   * active products count; unlimited-stock variants never run out.
   */
  async getInventoryOverview() {
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' }, select: { lowStockThreshold: true } });
    const threshold = config?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    const live = { isActive: true, product: { isActive: true } };
    const tracked = { ...live, trackInventory: true };

    const [stock, outOfStockCount, lowStockCount, unlimitedVariants, trackedVariants, items] = await Promise.all([
      this.prisma.productVariant.aggregate({ where: tracked, _sum: { stockQuantity: true } }),
      this.prisma.productVariant.count({ where: { ...tracked, stockQuantity: { lte: 0 } } }),
      this.prisma.productVariant.count({ where: { ...tracked, stockQuantity: { gt: 0, lte: threshold } } }),
      this.prisma.productVariant.count({ where: { ...live, trackInventory: false } }),
      this.prisma.productVariant.count({ where: tracked }),
      this.prisma.productVariant.findMany({
        where: { ...tracked, stockQuantity: { lte: threshold } },
        orderBy: [{ stockQuantity: 'asc' }, { createdAt: 'asc' }],
        take: 20,
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
              images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
            },
          },
        },
      }),
    ]);

    return {
      totalVariants: trackedVariants + unlimitedVariants,
      unlimitedVariants,
      totalStock: stock._sum.stockQuantity ?? 0,
      outOfStockCount,
      lowStockCount,
      lowStockThreshold: threshold,
      lowStockItems: items.map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productNameHe: v.product.nameHe,
        productNameEn: v.product.nameEn,
        productSlug: v.product.slug,
        color: v.color,
        size: v.size,
        stockQuantity: v.stockQuantity,
        image: v.product.images[0]?.url ?? null,
      })),
    };
  }

  /** Work waiting on the admin, whatever the selected range. */
  async getNeedsAttention() {
    const [ordersToProcess, pendingRefunds, pendingCancellations, inventory] = await Promise.all([
      this.prisma.order.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.refund.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.cancellationRequest.count({ where: { status: 'REQUESTED' } }),
      this.getInventoryOverview(),
    ]);
    return {
      ordersToProcess,
      pendingRefunds: { count: pendingRefunds._count._all, amount: round2(Number(pendingRefunds._sum.amount ?? 0)) },
      pendingCancellations,
      lowStockThreshold: inventory.lowStockThreshold,
      lowStockCount: inventory.lowStockCount,
      outOfStockCount: inventory.outOfStockCount,
      stockItems: inventory.lowStockItems,
    };
  }

  /** Orders created in the range as CSV (newest first, at most EXPORT_ROW_LIMIT rows). */
  async exportOrdersCsv(range: ResolvedRange): Promise<string> {
    const stamp = (col: string) => Prisma.raw(`to_char(${localTime(col)}, 'YYYY-MM-DD HH24:MI')`);
    const rows = await this.prisma.$queryRaw<
      {
        orderNumber: string;
        createdAt: string;
        status: string;
        customerEmail: string;
        units: number;
        subtotal: number;
        shippingCost: number;
        discountAmount: number;
        total: number;
        shippedAt: string | null;
        deliveredAt: string | null;
      }[]
    >(Prisma.sql`
      SELECT o."orderNumber", ${stamp('o."createdAt"')} AS "createdAt", o.status::text AS status, o."customerEmail",
             COALESCE((SELECT sum(oi.quantity) FROM order_items oi WHERE oi."orderId" = o.id), 0)::int AS units,
             o.subtotal::float8 AS subtotal, o."shippingCost"::float8 AS "shippingCost", o."discountAmount"::float8 AS "discountAmount", o.total::float8 AS total,
             ${stamp('o."shippedAt"')} AS "shippedAt", ${stamp('o."deliveredAt"')} AS "deliveredAt"
      FROM orders o
      WHERE ${inRange('o."createdAt"', range)}
      ORDER BY o."createdAt" DESC
      LIMIT ${EXPORT_ROW_LIMIT}`);

    const header = ['orderNumber', 'createdAt', 'status', 'customerEmail', 'units', 'subtotal', 'shipping', 'discount', 'total', 'shippedAt', 'deliveredAt'];
    const lines = rows.map((r) =>
      [r.orderNumber, r.createdAt, r.status, r.customerEmail, r.units, r.subtotal, r.shippingCost, r.discountAmount, r.total, r.shippedAt, r.deliveredAt]
        .map(csvCell)
        .join(','),
    );
    // BOM so Excel reads the UTF-8 correctly.
    return `\uFEFF${[header.join(','), ...lines].join('\r\n')}\r\n`;
  }
}

/** One CSV field: quoted when needed, and defanged if a spreadsheet would read it as a formula. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
