import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { EmailModule } from '../../src/email/email.module';
import { AnalyticsModule } from '../../src/analytics/analytics.module';
import { authRouter } from '../../src/auth/auth.router';
import { configureGlobalPipeline } from '../../src/common/app-setup';
import { resetDb, signUp, type TestApp } from './app';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule, EmailModule, AuthModule, AnalyticsModule],
})
class AnalyticsE2eModule {}

const BASE = '/v1/admin/analytics';
// Custom ranges keep every expectation independent of "today".
const RANGE = { from: '2026-10-19', to: '2026-10-20' };

describe('Admin analytics (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: ReturnType<typeof request.agent>;
  let t: TestApp;
  let seq = 0;
  let ids: { colorA: string; colorB: string; bikini: string; shorts: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AnalyticsE2eModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: false });
    app.use(authRouter);
    app.setGlobalPrefix('v1');
    configureGlobalPipeline(app);
    await app.init();
    prisma = app.get(PrismaService);
    const server = app.getHttpServer();
    t = { app, prisma, http: () => request(server), agent: () => request.agent(server), close: () => app.close() } as unknown as TestApp;
  });
  afterAll(async () => app.close());

  beforeEach(async () => {
    await resetDb(prisma);
    seq = 0;
    admin = (await signUp(t, { admin: true })).agent;
    const women = await prisma.category.create({ data: { nameHe: 'נשים', nameEn: 'Women', slug: 'women' } });
    const kids = await prisma.category.create({ data: { nameHe: 'ילדים', nameEn: 'Kids', slug: 'kids' } });
    const bikiniCat = await prisma.category.create({ data: { nameHe: 'ביקיני', nameEn: 'Bikini', slug: 'bikini', parentId: women.id } });
    const bikini = await prisma.product.create({
      data: { nameHe: 'ביקיני', nameEn: 'Bikini', slug: 'p-bikini', basePrice: 100, categoryId: bikiniCat.id, images: { create: { url: 'https://img.test/b.jpg' } } },
    });
    const shorts = await prisma.product.create({ data: { nameHe: 'שורט', nameEn: 'Shorts', slug: 'p-shorts', basePrice: 50, categoryId: kids.id } });
    const mk = (productId: string, color: string, size: string, stock: number, extra = {}) =>
      prisma.productVariant.create({ data: { productId, color, size, sku: `S-${color}-${size}-${productId}`, stockQuantity: stock, ...extra } });
    const colorA = await mk(bikini.id, 'Black', 'M', 50);
    const colorB = await mk(shorts.id, 'Blue', 'L', 50);
    ids = { colorA: colorA.id, colorB: colorB.id, bikini: bikini.id, shorts: shorts.id };
  });

  type OrderSeed = {
    at: string;
    status?: 'PENDING_PAYMENT' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
    total?: number;
    email?: string;
    variant?: string;
    qty?: number;
    unit?: number;
    shippedAt?: string;
    deliveredAt?: string;
    discount?: number;
    shipping?: number;
    couponId?: string;
  };
  async function order(o: OrderSeed) {
    seq += 1;
    const qty = o.qty ?? 1;
    const unit = o.unit ?? 100;
    return prisma.order.create({
      data: {
        orderNumber: `T-${seq}`,
        customerEmail: o.email ?? `buyer${seq}@example.test`,
        status: o.status ?? 'CONFIRMED',
        subtotal: qty * unit,
        shippingCost: o.shipping ?? 0,
        discountAmount: o.discount ?? 0,
        total: o.total ?? qty * unit,
        couponId: o.couponId,
        shippingCity: 'TLV',
        shippingStreet: 'x',
        shippingNumber: '1',
        createdAt: new Date(o.at),
        shippedAt: o.shippedAt ? new Date(o.shippedAt) : undefined,
        deliveredAt: o.deliveredAt ? new Date(o.deliveredAt) : undefined,
        items: {
          create: {
            variantId: o.variant ?? ids.colorA,
            productName: 'x',
            color: o.variant === ids.colorB ? 'Blue' : 'Black',
            size: o.variant === ids.colorB ? 'L' : 'M',
            quantity: qty,
            unitPrice: unit,
          },
        },
      },
    });
  }
  const get = (path: string, query: Record<string, string> = RANGE) => admin.get(`${BASE}/${path}`).query(query);

  describe('access', () => {
    const paths = ['overview', 'summary', 'sales', 'orders-by-status', 'top-products', 'revenue-by-category', 'sales-breakdown', 'customer-growth', 'inventory', 'needs-attention', 'export'];

    it.each(paths)('%s rejects anonymous visitors', async (path) => {
      await t.http().get(`${BASE}/${path}`).expect(401);
    });

    it.each(paths)('%s rejects customers (ADMIN only)', async (path) => {
      const { agent } = await signUp(t);
      await agent.get(`${BASE}/${path}`).expect(403);
    });

    it('serves admins', async () => {
      await get('summary').expect(200);
    });
  });

  describe('range validation', () => {
    it.each([
      [{ preset: 'forever' }],
      [{ from: '2026-13-01' }],
      [{ from: '2026-02-30' }],
      [{ from: '2026-10-20', to: '2026-10-19' }],
      [{ to: '2026-10-19' }],
      [{ from: '2020-01-01', to: '2026-10-19' }],
      [{ from: 'yesterday' }],
    ])('rejects %j', async (query) => {
      await get('summary', query as Record<string, string>).expect(400);
    });

    it('rejects an out-of-range top-products limit', async () => {
      await get('top-products', { ...RANGE, limit: '500' }).expect(400);
    });

    it('describes the resolved range and its comparison period', async () => {
      const res = await get('summary').expect(200);
      expect(res.body.range).toMatchObject({
        preset: 'custom', fromDay: '2026-10-19', toDay: '2026-10-20', days: 2, bucket: 'day', timeZone: 'Asia/Jerusalem',
        previous: { fromDay: '2026-10-17', toDay: '2026-10-18', days: 2 },
      });
    });
  });

  describe('summary', () => {
    it('counts only sales statuses as revenue and splits the rest out', async () => {
      await order({ at: '2026-10-19T09:00:00Z', status: 'CONFIRMED', total: 100, discount: 10, shipping: 20, qty: 1, unit: 90 });
      await order({ at: '2026-10-19T10:00:00Z', status: 'PROCESSING', total: 200, qty: 2 });
      await order({ at: '2026-10-19T11:00:00Z', status: 'SHIPPED', total: 300, qty: 3 });
      await order({ at: '2026-10-19T12:00:00Z', status: 'DELIVERED', total: 400, qty: 4, deliveredAt: '2026-10-20T08:00:00Z' });
      await order({ at: '2026-10-19T13:00:00Z', status: 'PENDING_PAYMENT', total: 999 });
      await order({ at: '2026-10-19T14:00:00Z', status: 'CANCELLED', total: 50 });
      await order({ at: '2026-10-19T15:00:00Z', status: 'REFUNDED', total: 70 });

      const { current } = (await get('summary').expect(200)).body;
      expect(current).toMatchObject({
        orders: 4, placed: 6, pendingPayment: 1, revenue: 1000, averageOrderValue: 250, unitsSold: 10,
        discountTotal: 10, shippingRevenue: 20, cancelled: 1, cancelledValue: 50, refunded: 1, refundedValue: 70,
        delivered: 1, deliveredRevenue: 400,
      });
    });

    it('counts coupon usage on sales orders only', async () => {
      const coupon = await prisma.coupon.create({ data: { code: 'HI', discountType: 'FIXED', value: 10 } });
      await order({ at: '2026-10-19T09:00:00Z', couponId: coupon.id, discount: 10 });
      await order({ at: '2026-10-19T09:30:00Z', couponId: coupon.id, status: 'CANCELLED' });
      await order({ at: '2026-10-19T10:00:00Z' });
      expect((await get('summary')).body.current.couponOrders).toBe(1);
    });

    it('puts an order at 22:30 UTC on the next Israel day, at the range edges', async () => {
      // 21:00Z on the 18th is exactly midnight (UTC+3) starting the 19th.
      await order({ at: '2026-10-18T20:59:59Z', total: 11 }); // 18th in Israel
      await order({ at: '2026-10-18T21:00:00Z', total: 22 }); // 19th
      await order({ at: '2026-10-20T20:59:59Z', total: 33 }); // 20th (still UTC+3 until the 25th)
      await order({ at: '2026-10-20T21:00:00Z', total: 44 }); // 21st
      const res = (await get('summary')).body;
      expect(res.current.revenue).toBe(55);
      expect(res.previous.revenue).toBe(11);
    });

    it('compares with the equal-length previous period', async () => {
      await order({ at: '2026-10-19T09:00:00Z', total: 150 });
      await order({ at: '2026-10-17T09:00:00Z', total: 100 });
      await order({ at: '2026-10-18T09:00:00Z', total: 100 });
      await order({ at: '2026-10-16T09:00:00Z', total: 5000 }); // before the comparison window
      const res = (await get('summary')).body;
      expect(res.previous.revenue).toBe(200);
      expect(res.previous.orders).toBe(2);
      expect(res.change.revenue).toBe(-25);
      expect(res.change.orders).toBe(-50);
    });

    it('has no % change when the previous period is empty, and none for all time', async () => {
      await order({ at: '2026-10-19T09:00:00Z' });
      expect((await get('summary')).body.change.revenue).toBeNull();
      const all = (await get('summary', { preset: 'all_time' })).body;
      expect(all.previous).toBeNull();
      expect(all.change).toBeNull();
      expect(all.current.orders).toBe(1);
    });

    it('measures delivered orders by deliveredAt, not by when they were placed', async () => {
      await order({ at: '2026-10-01T09:00:00Z', status: 'DELIVERED', total: 300, deliveredAt: '2026-10-19T09:00:00Z' });
      await order({ at: '2026-10-19T09:00:00Z', status: 'DELIVERED', total: 70, deliveredAt: '2026-10-25T09:00:00Z' });
      await order({ at: '2026-10-19T09:00:00Z', status: 'CONFIRMED', total: 10 });
      const { current } = (await get('summary')).body;
      expect(current.delivered).toBe(1);
      expect(current.deliveredRevenue).toBe(300);
      expect(current.orders).toBe(2); // the October 1st order was placed outside the range
    });

    it('counts shipped by shippedAt', async () => {
      await order({ at: '2026-10-10T09:00:00Z', status: 'SHIPPED', shippedAt: '2026-10-19T09:00:00Z' });
      await order({ at: '2026-10-19T09:00:00Z', status: 'CONFIRMED' });
      expect((await get('summary')).body.current.shipped).toBe(1);
    });

    it('splits new from returning customers', async () => {
      await order({ at: '2026-09-01T09:00:00Z', email: 'Old@example.test' });
      await order({ at: '2026-09-02T09:00:00Z', email: 'cancelled-before@example.test', status: 'CANCELLED' });
      await order({ at: '2026-10-19T09:00:00Z', email: 'old@example.test' });
      await order({ at: '2026-10-19T10:00:00Z', email: 'old@example.test' });
      await order({ at: '2026-10-19T11:00:00Z', email: 'fresh@example.test' });
      await order({ at: '2026-10-20T11:00:00Z', email: 'cancelled-before@example.test' });
      const { current } = (await get('summary')).body;
      expect(current).toMatchObject({ newCustomers: 2, returningCustomers: 1 });
    });
  });

  describe('sales series', () => {
    it('buckets by Israel day and fills empty days', async () => {
      await order({ at: '2026-10-19T22:30:00Z', total: 100, qty: 2 }); // 20th, 01:30 Israel
      await order({ at: '2026-10-19T20:30:00Z', total: 200, status: 'DELIVERED', deliveredAt: '2026-10-19T21:30:00Z' }); // 19th; delivered on the 20th
      const res = (await get('sales', { from: '2026-10-18', to: '2026-10-20' }).expect(200)).body;
      expect(res.bucket).toBe('day');
      expect(res.points).toEqual([
        { date: '2026-10-18', orders: 0, revenue: 0, units: 0, delivered: 0, deliveredRevenue: 0 },
        { date: '2026-10-19', orders: 1, revenue: 200, units: 1, delivered: 0, deliveredRevenue: 0 },
        { date: '2026-10-20', orders: 1, revenue: 100, units: 2, delivered: 1, deliveredRevenue: 200 },
      ]);
    });

    it('uses Sunday-start weeks for long ranges', async () => {
      await order({ at: '2026-09-05T09:00:00Z', total: 10 }); // Saturday -> week of Aug 30
      await order({ at: '2026-09-06T09:00:00Z', total: 20 }); // Sunday -> week of Sep 6
      const res = (await get('sales', { from: '2026-08-30', to: '2026-11-10' }).expect(200)).body;
      expect(res.bucket).toBe('week');
      expect(res.points[0]).toMatchObject({ date: '2026-08-30', revenue: 10 });
      expect(res.points[1]).toMatchObject({ date: '2026-09-06', revenue: 20 });
      expect(res.points.every((p: { date: string }) => new Date(p.date).getUTCDay() === 0)).toBe(true);
    });

    it('uses months for ranges over a year', async () => {
      await order({ at: '2026-03-31T21:30:00Z', total: 10 }); // 1 April, 00:30 (UTC+3 after the March switch)
      const res = (await get('sales', { from: '2025-01-01', to: '2026-10-20' }).expect(200)).body;
      expect(res.bucket).toBe('month');
      expect(res.points.find((p: { date: string }) => p.date === '2026-04-01')).toMatchObject({ revenue: 10 });
      expect(res.points.find((p: { date: string }) => p.date === '2026-03-01')).toMatchObject({ revenue: 0 });
    });
  });

  describe('breakdowns', () => {
    beforeEach(async () => {
      await order({ at: '2026-10-19T09:00:00Z', qty: 3, unit: 100, variant: ids.colorA });
      await order({ at: '2026-10-19T10:00:00Z', qty: 1, unit: 500, variant: ids.colorB });
      await order({ at: '2026-10-19T11:00:00Z', qty: 9, unit: 100, variant: ids.colorA, status: 'CANCELLED' });
    });

    it('orders by status in range', async () => {
      const res = (await get('orders-by-status')).body.statuses;
      expect(res).toEqual(expect.arrayContaining([{ status: 'CONFIRMED', count: 2, value: 800 }, { status: 'CANCELLED', count: 1, value: 900 }]));
    });

    it('top products by units and by revenue, sales only', async () => {
      const res = (await get('top-products')).body;
      expect(res.byUnits.map((p: { nameEn: string; units: number }) => [p.nameEn, p.units])).toEqual([['Bikini', 3], ['Shorts', 1]]);
      expect(res.byRevenue.map((p: { nameEn: string; revenue: number }) => [p.nameEn, p.revenue])).toEqual([['Shorts', 500], ['Bikini', 300]]);
      expect(res.byUnits[0]).toMatchObject({ orders: 1, image: 'https://img.test/b.jpg' });
      expect((await get('top-products', { ...RANGE, limit: '1' })).body.byUnits).toHaveLength(1);
    });

    it('revenue by top-level category and by product type', async () => {
      const res = (await get('revenue-by-category')).body;
      expect(res.topLevel.map((c: { nameEn: string; revenue: number }) => [c.nameEn, c.revenue])).toEqual([['Kids', 500], ['Women', 300]]);
      const bikini = res.byType.find((c: { nameEn: string }) => c.nameEn === 'Bikini');
      expect(bikini).toMatchObject({ parentNameEn: 'Women', revenue: 300, units: 3, orders: 1 });
    });

    it('sales by colour and size', async () => {
      const res = (await get('sales-breakdown')).body;
      expect(res.byColor).toEqual([{ value: 'Black', units: 3, revenue: 300 }, { value: 'Blue', units: 1, revenue: 500 }]);
      expect(res.bySize.map((s: { value: string }) => s.value)).toEqual(['M', 'L']);
    });
  });

  describe('customer growth', () => {
    it('counts new customer accounts, not admins', async () => {
      await prisma.user.create({ data: { email: 'c1@example.test', createdAt: new Date('2026-10-19T22:30:00Z') } });
      await prisma.user.create({ data: { email: 'c2@example.test', createdAt: new Date('2026-10-19T09:00:00Z') } });
      const res = (await get('customer-growth')).body;
      expect(res.points).toEqual([{ date: '2026-10-19', newCustomers: 1 }, { date: '2026-10-20', newCustomers: 1 }]);
    });
  });

  describe('needs attention', () => {
    it('reports orders waiting, pending refunds, cancellation requests and stock vs the configured threshold', async () => {
      await prisma.siteConfig.create({ data: { id: 'default', lowStockThreshold: 10 } });
      const confirmed = await order({ at: '2026-01-01T09:00:00Z', status: 'CONFIRMED' });
      await order({ at: '2026-01-02T09:00:00Z', status: 'PROCESSING' });
      const cancelled = await order({ at: '2026-01-03T09:00:00Z', status: 'CANCELLED', total: 80 });
      await prisma.refund.createMany({
        data: [
          { orderId: cancelled.id, amount: 80, status: 'PENDING' },
          { orderId: cancelled.id, amount: 20.5, status: 'PENDING' },
          { orderId: cancelled.id, amount: 999, status: 'COMPLETED' },
        ],
      });
      await prisma.cancellationRequest.createMany({
        data: [
          { orderId: confirmed.id, reason: 'x', status: 'REQUESTED' },
          { orderId: confirmed.id, reason: 'x', status: 'APPROVED' },
        ],
      });
      const p = ids.bikini;
      await prisma.productVariant.createMany({
        data: [
          { productId: p, color: 'Red', size: 'S', sku: 'low-9', stockQuantity: 9 },
          { productId: p, color: 'Red', size: 'M', sku: 'edge-10', stockQuantity: 10 },
          { productId: p, color: 'Red', size: 'L', sku: 'ok-11', stockQuantity: 11 },
          { productId: p, color: 'Red', size: 'XL', sku: 'out-0', stockQuantity: 0 },
          { productId: p, color: 'Green', size: 'S', sku: 'unlimited', stockQuantity: 0, trackInventory: false },
          { productId: p, color: 'Green', size: 'M', sku: 'inactive', stockQuantity: 0, isActive: false },
        ],
      });

      const res = (await admin.get(`${BASE}/needs-attention`).expect(200)).body;
      expect(res).toMatchObject({
        ordersToProcess: 1,
        pendingRefunds: { count: 2, amount: 100.5 },
        pendingCancellations: 1,
        lowStockThreshold: 10,
        lowStockCount: 2,
        outOfStockCount: 1,
      });
      expect(res.stockItems[0]).toMatchObject({ stockQuantity: 0, color: 'Red', size: 'XL', productNameEn: 'Bikini' });
      expect(res.stockItems.map((i: { stockQuantity: number }) => i.stockQuantity)).toEqual([0, 9, 10]);
    });

    it('defaults the threshold to 5 without a site config', async () => {
      await prisma.productVariant.update({ where: { id: ids.colorA }, data: { stockQuantity: 5 } });
      const res = (await admin.get(`${BASE}/needs-attention`).expect(200)).body;
      expect(res).toMatchObject({ lowStockThreshold: 5, lowStockCount: 1, outOfStockCount: 0 });
    });
  });

  describe('overview "today"', () => {
    it('is the Israel day, not the UTC day', async () => {
      const now = new Date();
      // Noon today in Israel is safely inside today in both UTC and Israel; "00:30 Israel" tomorrow is not.
      await order({ at: new Date(now.getTime()).toISOString(), total: 40 });
      const res = (await admin.get(`${BASE}/overview`).expect(200)).body;
      expect(res.todayOrders).toBe(1);
      expect(res.todayRevenue).toBe(40);
    });
  });

  describe('many rows', () => {
    it('aggregates 600 orders without loading them into the app', async () => {
      const rows = Array.from({ length: 600 }, (_, i) => ({
        orderNumber: `BULK-${i}`,
        customerEmail: `bulk${i % 50}@example.test`,
        status: 'CONFIRMED' as const,
        subtotal: 10,
        shippingCost: 0,
        total: 10,
        shippingCity: 'x',
        shippingStreet: 'x',
        shippingNumber: '1',
        createdAt: new Date(Date.UTC(2026, 9, 19, 6 + (i % 12), i % 60)),
      }));
      await prisma.order.createMany({ data: rows });

      const spies = [jest.spyOn(prisma.order, 'findMany'), jest.spyOn(prisma.orderItem, 'findMany')];
      const summary = (await get('summary')).body;
      const sales = (await get('sales')).body;
      await get('top-products').expect(200);
      await get('revenue-by-category').expect(200);
      await get('sales-breakdown').expect(200);
      await get('orders-by-status').expect(200);
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      spies.forEach((s) => s.mockRestore());

      expect(summary.current).toMatchObject({ orders: 600, revenue: 6000, averageOrderValue: 10, newCustomers: 50 });
      expect(sales.points.reduce((s: number, p: { orders: number }) => s + p.orders, 0)).toBe(600);
    });
  });

  describe('orders CSV export', () => {
    it('exports the orders created in the range, in Israel time, defanging formulas', async () => {
      await order({ at: '2026-10-19T22:30:00Z', total: 100, email: '=cmd@example.test', qty: 2, status: 'DELIVERED', deliveredAt: '2026-10-20T10:00:00Z' });
      await order({ at: '2026-10-25T10:00:00Z' }); // outside the range
      const res = await get('export').expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('baia-orders-2026-10-19_2026-10-20.csv');
      const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('orderNumber,createdAt,status,customerEmail,units,subtotal,shipping,discount,total,shippedAt,deliveredAt');
      expect(lines[1]).toBe("T-1,2026-10-20 01:30,DELIVERED,'=cmd@example.test,2,200,0,0,100,,2026-10-20 13:00");
    });
  });
});
