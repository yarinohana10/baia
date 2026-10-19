import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService, REVENUE_STATUSES, dayKey } from '../src/analytics/analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createMockPrismaService } from './helpers';

/** Today's day key, in the store's timezone (Israel), as the service builds it. */
function todayMapKey(): string {
  return dayKey(new Date());
}

function yesterdayMapKey(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/** Noon Israel time on the given day, so it falls in that day's bucket. */
function mockDateForMapKey(mapKey: string): Date {
  return new Date(mapKey + 'T12:00:00+03:00');
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getOverview', () => {
    it('should return overview statistics', async () => {
      prisma.order.count
        .mockResolvedValueOnce(42)
        .mockResolvedValueOnce(5);
      prisma.order.aggregate
        .mockResolvedValueOnce({ _sum: { total: 10000 } })
        .mockResolvedValueOnce({ _sum: { total: 500 } });
      prisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(3);
      prisma.product.count.mockResolvedValue(19);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.getOverview();

      expect(result.totalOrders).toBe(42);
      expect(result.todayOrders).toBe(5);
      expect(result.totalRevenue).toBe(10000);
      expect(result.todayRevenue).toBe(500);
      expect(result.totalCustomers).toBe(100);
      expect(result.newCustomersToday).toBe(3);
      expect(result.totalProducts).toBe(19);
      expect(result.recentOrders).toEqual([]);
    });

    it('should handle null revenue sums', async () => {
      prisma.order.count.mockResolvedValue(0);
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: null } });
      prisma.user.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.getOverview();

      expect(result.totalRevenue).toBe(0);
      expect(result.todayRevenue).toBe(0);
    });

    it('should convert totals in recentOrders via Number()', async () => {
      prisma.order.count.mockResolvedValue(1);
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: 100 } });
      prisma.user.count.mockResolvedValue(1);
      prisma.product.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          customerEmail: 'test@test.com',
          total: 150,
          status: 'CONFIRMED',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getOverview();

      expect(result.recentOrders[0].total).toBe(150);
    });
  });

  describe('getSales', () => {
    it('should return daily sales data for N days', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.getSales(7);

      expect(result.days).toHaveLength(7);
      result.days.forEach((day) => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('orders');
        expect(day).toHaveProperty('revenue');
        expect(day.orders).toBe(0);
        expect(day.revenue).toBe(0);
      });
    });

    it('should aggregate orders into correct day buckets', async () => {
      const key = todayMapKey();
      const mockDate = mockDateForMapKey(key);

      prisma.order.findMany.mockResolvedValue([
        { createdAt: mockDate, total: 100 },
        { createdAt: mockDate, total: 200 },
      ]);

      const result = await service.getSales(1);

      expect(result.days).toHaveLength(1);
      expect(result.days[0].date).toBe(key);
      expect(result.days[0].orders).toBe(2);
      expect(result.days[0].revenue).toBe(300);
    });

    it('should round revenue to 2 decimal places', async () => {
      const key = todayMapKey();
      const mockDate = mockDateForMapKey(key);

      prisma.order.findMany.mockResolvedValue([
        { createdAt: mockDate, total: 33.333 },
      ]);

      const result = await service.getSales(1);

      expect(result.days[0].revenue).toBe(33.33);
    });
  });

  describe('getOrdersByStatus', () => {
    it('should return order counts grouped by status', async () => {
      prisma.order.groupBy.mockResolvedValue([
        { status: 'PENDING_PAYMENT', _count: { id: 5 } },
        { status: 'CONFIRMED', _count: { id: 10 } },
        { status: 'SHIPPED', _count: { id: 3 } },
      ]);

      const result = await service.getOrdersByStatus();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ status: 'PENDING_PAYMENT', count: 5 });
      expect(result[1]).toEqual({ status: 'CONFIRMED', count: 10 });
      expect(result[2]).toEqual({ status: 'SHIPPED', count: 3 });
    });

    it('should return empty array if no orders', async () => {
      prisma.order.groupBy.mockResolvedValue([]);

      const result = await service.getOrdersByStatus();

      expect(result).toEqual([]);
    });
  });

  describe('getTopProducts', () => {
    let variantFindMany: jest.Mock;

    beforeEach(() => {
      variantFindMany = jest.fn().mockResolvedValue([]);
      (prisma.productVariant as any).findMany = variantFindMany;
      prisma.product.findMany.mockResolvedValue([]);
    });

    it('combines the sizes/colours of one product into a single entry', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        { variantId: 'var-m', productName: 'Classic Shorts', _sum: { quantity: 30 }, _count: { id: 12 } },
        { variantId: 'var-l', productName: 'Classic Shorts', _sum: { quantity: 20 }, _count: { id: 8 } },
        { variantId: 'var-x', productName: 'Bikini', _sum: { quantity: 40 }, _count: { id: 10 } },
      ]);
      variantFindMany.mockResolvedValue([
        { id: 'var-m', productId: 'prod-1' },
        { id: 'var-l', productId: 'prod-1' },
        { id: 'var-x', productId: 'prod-2' },
      ]);
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', nameHe: 'מכנסי ים', nameEn: 'Classic Shorts', images: [{ url: '/img.jpg' }] },
        { id: 'prod-2', nameHe: 'ביקיני', nameEn: 'Bikini', images: [] },
      ]);

      const result = await service.getTopProducts(5);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ productId: 'prod-1', totalQuantity: 50, orderCount: 20 });
      expect(result[0].product).toEqual({ id: 'prod-1', nameHe: 'מכנסי ים', nameEn: 'Classic Shorts', image: '/img.jpg' });
      expect(result[1]).toMatchObject({ productId: 'prod-2', totalQuantity: 40 });
    });

    it('only counts sales orders (not pending, cancelled or refunded)', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([]);

      await service.getTopProducts(5);

      expect(prisma.orderItem.groupBy.mock.calls[0][0].where).toEqual({
        order: { status: { in: REVENUE_STATUSES } },
      });
    });

    it('applies the limit after grouping by product', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        { variantId: 'a', productName: 'A', _sum: { quantity: 1 }, _count: { id: 1 } },
        { variantId: 'b', productName: 'B', _sum: { quantity: 3 }, _count: { id: 1 } },
        { variantId: 'c', productName: 'C', _sum: { quantity: 2 }, _count: { id: 1 } },
      ]);

      const result = await service.getTopProducts(2);

      expect(result.map((r) => r.productName)).toEqual(['B', 'C']);
    });

    it('should handle missing variant (deleted product)', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        { variantId: 'deleted-var', productName: 'Deleted Product', _sum: { quantity: 5 }, _count: { id: 2 } },
      ]);

      const result = await service.getTopProducts(5);

      expect(result).toHaveLength(1);
      expect(result[0].product).toBeNull();
      expect(result[0].productId).toBeNull();
    });

    it('should default to quantity 0 if sum is null', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        { variantId: 'var-1', productName: 'Product', _sum: { quantity: null }, _count: { id: 1 } },
      ]);

      const result = await service.getTopProducts(5);

      expect(result[0].totalQuantity).toBe(0);
    });
  });

  describe('revenue statuses and day ranges', () => {
    it('counts only CONFIRMED/PROCESSING/SHIPPED/DELIVERED orders as revenue', async () => {
      prisma.order.count.mockResolvedValue(0);
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: null } });
      prisma.user.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      prisma.order.findMany.mockResolvedValue([]);

      await service.getOverview();

      for (const [args] of prisma.order.aggregate.mock.calls) {
        expect(args.where.status).toEqual({ in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] });
      }
      expect(REVENUE_STATUSES).not.toContain('PENDING_PAYMENT');
    });

    it('excludes pending orders from daily sales', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.getSales(7);
      expect(prisma.order.findMany.mock.calls[0][0].where.status).toEqual({ in: REVENUE_STATUSES });
    });

    it.each([
      [0, 1],
      [-10, 1],
      [5000, 365],
      [NaN, 30],
    ])('clamps days=%p to %p', async (input, expected) => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      expect((await service.getSales(input)).days).toHaveLength(expected);
      expect((await service.getCustomerGrowth(input)).days).toHaveLength(expected);
      expect((await service.getAverageOrderValue(input)).days).toHaveLength(expected);
    });
  });

  describe('getInventoryOverview', () => {
    it('reports unlimited-stock variants separately and skips hidden products', async () => {
      (prisma.productVariant as any).findMany = jest.fn().mockResolvedValue([
        { id: 'v1', color: 'Black', size: 'M', stockQuantity: 0, product: { id: 'p', nameHe: 'א', nameEn: 'A', slug: 'a', isActive: true, images: [] } },
        { id: 'v2', color: 'Black', size: 'L', stockQuantity: 10, product: { id: 'p', nameHe: 'א', nameEn: 'A', slug: 'a', isActive: true, images: [] } },
      ]);
      (prisma.productVariant as any).count = jest.fn().mockResolvedValue(4);

      const result = await service.getInventoryOverview();

      const where = (prisma.productVariant as any).findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ isActive: true, trackInventory: true, product: { isActive: true } });
      expect(result).toMatchObject({ totalVariants: 6, unlimitedVariants: 4, outOfStockCount: 1, totalStock: 10 });
    });
  });

  describe('getRevenueByCategory', () => {
    it('should aggregate revenue by top-level category', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        {
          quantity: 2,
          unitPrice: 150,
          variant: {
            product: {
              category: {
                id: 'sub-cat',
                nameHe: 'מכנסי ים',
                nameEn: 'Swim Shorts',
                parent: { id: 'men', nameHe: 'גברים', nameEn: 'Men' },
              },
            },
          },
        },
        {
          quantity: 1,
          unitPrice: 200,
          variant: {
            product: {
              category: {
                id: 'women',
                nameHe: 'נשים',
                nameEn: 'Women',
                parent: null,
              },
            },
          },
        },
      ]);

      const result = await service.getRevenueByCategory();

      expect(result).toHaveLength(2);

      const men = result.find((r) => r.categoryId === 'men');
      expect(men).toBeDefined();
      expect(men!.revenue).toBe(300);
      expect(men!.nameEn).toBe('Men');

      const women = result.find((r) => r.categoryId === 'women');
      expect(women).toBeDefined();
      expect(women!.revenue).toBe(200);
    });

    it('should merge multiple items in same top-level category', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        {
          quantity: 1,
          unitPrice: 100,
          variant: {
            product: {
              category: {
                id: 'men', nameHe: 'גברים', nameEn: 'Men', parent: null,
              },
            },
          },
        },
        {
          quantity: 2,
          unitPrice: 50,
          variant: {
            product: {
              category: {
                id: 'men', nameHe: 'גברים', nameEn: 'Men', parent: null,
              },
            },
          },
        },
      ]);

      const result = await service.getRevenueByCategory();

      expect(result).toHaveLength(1);
      expect(result[0].revenue).toBe(200); // (1*100) + (2*50)
      expect(result[0].orders).toBe(2);
    });

    it('should return empty array when no order items', async () => {
      prisma.orderItem.findMany.mockResolvedValue([]);

      const result = await service.getRevenueByCategory();

      expect(result).toEqual([]);
    });
  });

  describe('getCustomerGrowth', () => {
    it('should return daily new customer counts for N days', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getCustomerGrowth(7);

      expect(result.days).toHaveLength(7);
      result.days.forEach((day) => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('newCustomers');
        expect(day.newCustomers).toBe(0);
      });
    });

    it('should count customers on correct days', async () => {
      const key = todayMapKey();
      const mockDate = mockDateForMapKey(key);

      prisma.user.findMany.mockResolvedValue([
        { createdAt: mockDate },
        { createdAt: mockDate },
      ]);

      const result = await service.getCustomerGrowth(1);

      expect(result.days[0].date).toBe(key);
      expect(result.days[0].newCustomers).toBe(2);
    });
  });

  describe('getAverageOrderValue', () => {
    it('should calculate overall AOV', async () => {
      const key = todayMapKey();
      const mockDate = mockDateForMapKey(key);

      prisma.order.findMany.mockResolvedValue([
        { createdAt: mockDate, total: 200 },
        { createdAt: mockDate, total: 400 },
      ]);

      const result = await service.getAverageOrderValue(1);

      expect(result.overallAverage).toBe(300);
      expect(result.totalOrders).toBe(2);
      expect(result.days).toHaveLength(1);
      expect(result.days[0].averageOrderValue).toBe(300);
      expect(result.days[0].orderCount).toBe(2);
    });

    it('should return 0 AOV when no orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.getAverageOrderValue(7);

      expect(result.overallAverage).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.days).toHaveLength(7);
      result.days.forEach((day) => {
        expect(day.averageOrderValue).toBe(0);
        expect(day.orderCount).toBe(0);
      });
    });

    it('should calculate per-day AOV correctly', async () => {
      const todayK = todayMapKey();
      const yesterdayK = yesterdayMapKey();
      const todayMock = mockDateForMapKey(todayK);
      const yesterdayMock = mockDateForMapKey(yesterdayK);

      prisma.order.findMany.mockResolvedValue([
        { createdAt: yesterdayMock, total: 100 },
        { createdAt: todayMock, total: 200 },
        { createdAt: todayMock, total: 300 },
      ]);

      const result = await service.getAverageOrderValue(2);

      expect(result.totalOrders).toBe(3);
      expect(result.overallAverage).toBe(200); // (100+200+300)/3

      const yesterdayEntry = result.days.find((d) => d.date === yesterdayK);
      const todayEntry = result.days.find((d) => d.date === todayK);

      expect(yesterdayEntry?.averageOrderValue).toBe(100);
      expect(yesterdayEntry?.orderCount).toBe(1);
      expect(todayEntry?.averageOrderValue).toBe(250);
      expect(todayEntry?.orderCount).toBe(2);
    });
  });
});
