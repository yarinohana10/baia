import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createMockPrismaService } from './helpers';

/**
 * Helper to create a Date at noon today (local time).
 * The service uses `createdAt.toISOString().split('T')[0]` to build map keys,
 * so the mock dates must produce the same ISO-date string as the map key.
 * The map keys are built from `startOfDay().toISOString().split('T')[0]`.
 * Using the same approach ensures they match.
 */
function todayAtNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function isoDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Get today's map key as the service would generate it:
 * `startOfDay().toISOString().split('T')[0]`.
 */
function todayMapKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function yesterdayMapKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Create a mock date that will produce the same ISO date string
 * as the `startOfDay()` helper in the service.
 * The trick: use a Date built from the same ISO key so `toISOString()` matches.
 */
function mockDateForMapKey(mapKey: string): Date {
  return new Date(mapKey + 'T12:00:00.000Z');
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
    it('should return top selling products with details', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        {
          variantId: 'var-1',
          productName: 'Classic Shorts',
          _sum: { quantity: 50 },
          _count: { id: 20 },
        },
      ]);
      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'var-1',
        product: {
          id: 'prod-1',
          nameHe: 'מכנסי ים',
          nameEn: 'Classic Shorts',
          images: [{ url: '/img.jpg', upload: null }],
        },
      });

      const result = await service.getTopProducts(5);

      expect(result).toHaveLength(1);
      expect(result[0].productName).toBe('Classic Shorts');
      expect(result[0].totalQuantity).toBe(50);
      expect(result[0].orderCount).toBe(20);
      expect(result[0].product).toBeDefined();
      expect(result[0].product!.nameEn).toBe('Classic Shorts');
    });

    it('should handle missing variant (deleted product)', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        {
          variantId: 'deleted-var',
          productName: 'Deleted Product',
          _sum: { quantity: 5 },
          _count: { id: 2 },
        },
      ]);
      prisma.productVariant.findUnique.mockResolvedValue(null);

      const result = await service.getTopProducts(5);

      expect(result).toHaveLength(1);
      expect(result[0].product).toBeNull();
    });

    it('should default to quantity 0 if sum is null', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        {
          variantId: 'var-1',
          productName: 'Product',
          _sum: { quantity: null },
          _count: { id: 1 },
        },
      ]);
      prisma.productVariant.findUnique.mockResolvedValue(null);

      const result = await service.getTopProducts(5);

      expect(result[0].totalQuantity).toBe(0);
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
